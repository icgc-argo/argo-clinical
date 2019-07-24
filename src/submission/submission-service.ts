import * as dataValidator from "./validation";
import { donorDao, RegisterSpecimenDto } from "../clinical/donor-repo";
import * as _ from "lodash";
import { registrationRepository } from "./registration-repo";
import { Donor, DonorMap } from "../clinical/clinical-entities";
import { RegisterDonorDto } from "../clinical/donor-repo";
import { ActiveRegistration, RegistrationRecord, RegistrationStats } from "./submission-entities";
import * as schemaManager from "../lectern-client/schema-manager";
import { SchemaValidationError, TypedDataRecord } from "../lectern-client/schema-entities";
import { loggerFor } from "../logger";
import { Errors, F } from "../utils";
import { DeepReadonly } from "deep-freeze";
import deepFreeze = require("deep-freeze");
const L = loggerFor(__filename);

export namespace operations {
  /**
   * This method creates an in progress registration after validating but doesn't create the donors in the donor collection
   * it overrides and deletes any previously uncomitted registrations.
   * @param command CreateRegistrationCommand the records to register,
   *  can contain new donors or existing donors but new samples.
   */
  export const createRegistration = async (
    command: CreateRegistrationCommand
  ): Promise<CreateRegistrationResult> => {
    const schemaResult = schemaManager.process("registration", command.records);
    const processedRecords = schemaResult.processedRecords;

    // if there are errors terminate the creation.
    if (anyErrors(schemaResult.validationErrors)) {
      L.info(`found ${schemaResult.validationErrors.length} schema errors in registration attempt`);
      return {
        registrationId: undefined,
        state: undefined,
        errors: schemaResult.validationErrors,
        stats: undefined,
        successful: false
      };
    }

    const registrationRecords = mapToRegistrationRecord(processedRecords);
    const filter = F(
      registrationRecords.map(rc => {
        return {
          programId: rc.programId,
          submitterId: rc.donorSubmitterId
        };
      })
    );

    // fetch related donor docs from the db
    let donorDocs = await donorDao.findByProgramAndSubmitterId(filter);
    if (!donorDocs) {
      donorDocs = [];
    }

    const donors = F(donorDocs);
    // build a donor hash map for faster access to donors
    const donorByIdMapTemp: { [id: string]: DeepReadonly<Donor> } = {};
    donors.forEach(dc => {
      donorByIdMapTemp[dc.submitterId] = _.cloneDeep(dc);
    });
    const donorsBySubmitterIdMap: DeepReadonly<DonorMap> = F(donorByIdMapTemp);

    const { errors } = await dataValidator.validateRegistrationData(
      registrationRecords,
      donorsBySubmitterIdMap
    );
    if (errors.length > 0) {
      L.info(`found ${errors.length} data errors in registration attempt`);
      return F({
        registrationId: undefined,
        state: undefined,
        stats: undefined,
        errors: errors,
        successful: false
      });
    }

    const stats = calculateUpdates(registrationRecords, donorsBySubmitterIdMap);

    // delete any existing active registration to replace it with the new one
    // we can only have 1 active registration per program
    const existingActivRegistration = await registrationRepository.findByProgramId(
      command.programId
    );

    if (existingActivRegistration != undefined && existingActivRegistration.id) {
      await registrationRepository.delete(existingActivRegistration.id);
    }

    // save the new registration object
    const registration = toActiveRegistration(command, registrationRecords);
    const savedRegistration = await registrationRepository.create(registration);
    return F({
      registrationId: savedRegistration.id,
      state: "uncommitted",
      errors: [],
      stats,
      successful: true
    });
  };

  const calculateUpdates = (
    records: DeepReadonly<CreateRegistrationRecord[]>,
    donorsBySubmitterIdMap: DeepReadonly<DonorMap>
  ) => {
    const stats: RegistrationStats = {
      newDonorIds: {},
      newSpecimenIds: {},
      newSampleIds: {},
      alreadyRegistered: {}
    };

    records.forEach((nd, index) => {
      const existingDonor = donorsBySubmitterIdMap[nd.donorSubmitterId];
      if (!existingDonor) {
        addNewDonorToStats(stats, nd, index);
        addNewSpecimenToStats(stats, nd, index);
        addNewSampleToStats(stats, nd, index);
        return;
      }

      const existingSpecimen = existingDonor.specimens.find(
        s => s.submitterId === nd.specimenSubmitterId
      );
      if (!existingSpecimen) {
        addNewSpecimenToStats(stats, nd, index);
        addNewSampleToStats(stats, nd, index);
        return;
      }

      const existingSample = existingSpecimen.samples.find(
        sa => sa.submitterId === nd.sampleSubmitterId
      );
      if (!existingSample) return addNewSampleToStats(stats, nd, index);

      // otherwise it's already registered record
      if (!stats.alreadyRegistered[nd.donorSubmitterId]) {
        stats.alreadyRegistered[nd.donorSubmitterId] = [index];
        return;
      }

      stats.alreadyRegistered[nd.donorSubmitterId].push(index);
      return;
    });

    return F(stats);
  };

  const addNewDonorToStats = (
    stats: RegistrationStats,
    newDonor: CreateRegistrationRecord,
    index: number
  ) => {
    // if we didn't encounter this donor id in a previous row then
    // the sample and specimen ids are new
    if (!stats.newDonorIds[newDonor.donorSubmitterId]) {
      stats.newDonorIds[newDonor.donorSubmitterId] = [index];
      return;
    }
    // otherwise we encountered the same donor but different specimen or sample
    stats.newDonorIds[newDonor.donorSubmitterId].push(index);
  };

  const addNewSpecimenToStats = (
    stats: RegistrationStats,
    newDonor: CreateRegistrationRecord,
    index: number
  ) => {
    // if the specimen id is not encountered we add it along with the sampleId
    if (!stats.newSpecimenIds[newDonor.specimenSubmitterId]) {
      stats.newSpecimenIds[newDonor.specimenSubmitterId] = [index];
      return;
    }
    // otherwise just add the new row number (same donor, same specimen, different row)
    stats.newSpecimenIds[newDonor.specimenSubmitterId].push(index);
  };

  const addNewSampleToStats = (
    stats: RegistrationStats,
    newDonor: CreateRegistrationRecord,
    index: number
  ) => {
    if (!stats.newSampleIds[newDonor.sampleSubmitterId]) {
      stats.newSampleIds[newDonor.sampleSubmitterId] = [index];
      return;
    }
    stats.newSampleIds[newDonor.sampleSubmitterId].push(index);
    return;
  };

  /**
   * TBD
   * This method will move the registered donor document to donor collection
   * and remove it from active registration collection.
   *
   * @param command CommitRegistrationCommand the id of the registration to close.
   */
  export const commitRegisteration = async (
    command: Readonly<CommitRegistrationCommand>
  ): Promise<DeepReadonly<Donor[]>> => {
    const registration = await registrationRepository.findById(command.registrationId);
    if (registration == undefined) {
      throw new Errors.NotFound(`no registration with id :${command.registrationId} found`);
    }

    const donorRecords: DeepReadonly<RegisterDonorDto[]> = mapToDonorRecords(registration);
    const savedDonors: DeepReadonly<Donor>[] = [];

    donorRecords.forEach(async rd => {
      const donors = await donorDao.findByProgramAndSubmitterId([
        { programId: rd.programId, submitterId: rd.submitterId }
      ]);
      if (donors && donors.length == 0) {
        const saved = await donorDao.register(rd);
        savedDonors.push(saved);
        return;
      }

      return undefined;
    });

    // todo: delete registration
    return F(savedDonors);
  };

  const mapToDonorRecords = (registration: DeepReadonly<ActiveRegistration>) => {
    const donors: RegisterDonorDto[] = [];
    registration.records.forEach(rec => {
      // if the donor doesn't exist add it
      let donor = donors.find(d => d.submitterId === rec.donorSubmitterId);
      if (!donor) {
        const firstSpecimen = getDonorSpecimen(rec);
        donor = {
          submitterId: rec.donorSubmitterId,
          gender: rec.gender,
          programId: registration.programId,
          specimens: [firstSpecimen]
        };
        donors.push(donor);
        return;
      }

      // if the specimen doesn't exist add it
      let specimen = donor.specimens.find(s => s.submitterId === rec.specimenSubmitterId);
      if (!specimen) {
        specimen = getDonorSpecimen(rec);
        donor.specimens.push(specimen);
      } else {
        specimen.samples.push({
          sampleType: rec.sampleType,
          submitterId: rec.sampleSubmitterId
        });
      }
    });
    return F(donors);
  };

  const getDonorSpecimen = (record: RegistrationRecord) => {
    return {
      specimenType: record.specimenType,
      tumourNormalDesignation: record.tumourNormalDesignation,
      submitterId: record.specimenSubmitterId,
      samples: [
        {
          sampleType: record.sampleType,
          submitterId: record.sampleSubmitterId
        }
      ]
    };
  };
  /**
   * find registration by program Id
   * @param programId string
   */
  export const findByProgramId = async (programId: string) => {
    return await registrationRepository.findByProgramId(programId);
  };

  /************* Private methods *************/
  function toActiveRegistration(
    command: CreateRegistrationCommand,
    registrationRecords: ReadonlyArray<CreateRegistrationRecord>
  ) {
    return F({
      programId: command.programId,
      creator: command.creator,
      records: registrationRecords.map(r => {
        const record: Readonly<RegistrationRecord> = {
          donorSubmitterId: r.donorSubmitterId,
          gender: r.gender,
          specimenSubmitterId: r.specimenSubmitterId,
          specimenType: r.specimenType,
          tumourNormalDesignation: r.tumourNormalDesignation,
          sampleSubmitterId: r.sampleSubmitterId,
          sampleType: r.sampleType
        };
        return record;
      })
    });
  }

  function anyErrors(schemaErrors: DeepReadonly<SchemaValidationError[]>) {
    return schemaErrors.length > 0 || schemaErrors.length > 0;
  }

  function mapToRegistrationRecord(records: DeepReadonly<TypedDataRecord[]>) {
    return F(
      records.map(r => {
        const rec: CreateRegistrationRecord = {
          programId: r.program_id as string,
          donorSubmitterId: r.donor_submitter_id as string,
          gender: r.gender as string,
          specimenSubmitterId: r.specimen_submitter_id as string,
          specimenType: r.specimen_type as string,
          tumourNormalDesignation: r.tumour_normal_designation as string,
          sampleSubmitterId: r.sample_submitter_id as string,
          sampleType: r.sample_type as string
        };
        return rec;
      })
    );
  }
}

export interface CreateRegistrationRecord {
  readonly programId: string;
  readonly donorSubmitterId: string;
  readonly gender: string;
  readonly specimenSubmitterId: string;
  readonly specimenType: string;
  readonly tumourNormalDesignation: string;
  readonly sampleSubmitterId: string;
  readonly sampleType: string;
}

export interface CommitRegistrationCommand {
  readonly registrationId: string;
}

export interface CreateRegistrationCommand {
  // we define the records as arbitrary key value pairs to be validated by the schema
  // before we put them in a CreateRegistrationRecord, in case a column is missing so we let dictionary handle error collection.
  records: ReadonlyArray<Readonly<{ [key: string]: string }>>;
  readonly creator: string;
  readonly programId: string;
}

export interface CreateRegistrationResult {
  readonly registrationId: string | undefined;
  readonly state: string | undefined;
  readonly successful: boolean;
  readonly stats: any;
  errors: ReadonlyArray<Readonly<any>>;
}

export interface ValidationResult {
  errors: ReadonlyArray<Readonly<any>>;
}
