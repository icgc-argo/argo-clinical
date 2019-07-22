import * as dataValidator from "./validation";
import { donorDao, RegisterSpecimenDto } from "../clinical/donor-repo";
import { registrationRepository } from "./registration-repo";
import { Donor } from "../clinical/clinical-entities";
import { RegisterDonorDto } from "../clinical/donor-repo";
import { ActiveRegistration, RegistrationRecord } from "./submission-entities";
import * as schemaManager from "../lectern-client/schema-manager";
import {
  SchemaValidationErrors,
  SchemaValidationError,
  TypedDataRecord
} from "../lectern-client/schema-entities";
import { loggerFor } from "../logger";
import { Errors } from "../utils";
import { map } from "bluebird";
import { add } from "winston";
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
        successful: false
      };
    }

    const registrationRecords = mapToRegistrationRecord(processedRecords);
    const filter = registrationRecords.map(rc => {
      return {
        programId: rc.programId,
        submitterId: rc.donorSubmitterId
      };
    });
    const donorDocs = await donorDao.findByProgramAndSubmitterId(filter);
    const { errors: dataErrors } = dataValidator.validateRegistrationData(registrationRecords);
    if (dataErrors.length > 0) {
      L.info(`found ${dataErrors.length} data errors in registration attempt`);
      return {
        registrationId: undefined,
        state: undefined,
        errors: dataErrors,
        successful: false
      };
    }
    // build the registration object
    const registration: ActiveRegistration = toActiveRegistration(command, registrationRecords);

    // delete any existing active registration to replace it with the new one
    // we can only have 1 active registration per program
    const existingActivRegistration = await registrationRepository.findByProgramId(
      command.programId
    );
    if (existingActivRegistration != undefined && existingActivRegistration.id) {
      await registrationRepository.delete(existingActivRegistration.id);
    }

    // save the new registration object
    const savedRegistration = await registrationRepository.create(registration);
    return {
      registrationId: savedRegistration.id,
      state: "uncommitted",
      errors: [],
      successful: true
    };
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
  ): Promise<Donor[]> => {
    const registration = await registrationRepository.findById(command.registrationId);
    if (registration == undefined) {
      throw new Errors.NotFound(`no registration with id :${command.registrationId} found`);
    }

    const donorRecords: ReadonlyArray<RegisterDonorDto> = mapToDonorRecords(registration);
    const savedDonors: Donor[] = [];

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
    return savedDonors;
  };

  const mapToDonorRecords = (registration: ActiveRegistration) => {
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
      return donor;
    });
    return donors;
  };

  const getDonorSpecimen = (record: RegistrationRecord): RegisterSpecimenDto => {
    return {
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
  ): Readonly<ActiveRegistration> {
    return {
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
    };
  }

  function anyErrors(schemaErrors: SchemaValidationError[]) {
    return schemaErrors.length > 0 || schemaErrors.length > 0;
  }

  function mapToRegistrationRecord(
    records: TypedDataRecord[]
  ): ReadonlyArray<CreateRegistrationRecord> {
    return records.map(r => {
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
    });
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
  errors: ReadonlyArray<Readonly<any>>;
}

export interface ValidationResult {
  errors: ReadonlyArray<Readonly<any>>;
}
