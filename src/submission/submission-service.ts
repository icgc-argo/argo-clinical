import * as dataValidator from "./validation";
import { donorDao, FindByProgramAndSubmitterFilter } from "../clinical/donor-repo";
import _ from "lodash";
import { registrationRepository } from "./registration-repo";
import { Donor, DonorMap } from "../clinical/clinical-entities";
import {
  ActiveRegistration,
  SubmittedRegistrationRecord,
  RegistrationStats,
  ClinicalValidationError,
  CreateRegistrationRecord,
  CreateRegistrationCommand,
  CreateRegistrationResult,
  RegistrationRecordFields,
  FieldsEnum,
  SaveClinicalCommand,
  CreateClinicalResult
} from "./submission-entities";
import * as schemaManager from "../lectern-client/schema-manager";
import {
  SchemaValidationError,
  TypedDataRecord,
  DataRecord,
  SchemaProcessingResult
} from "../lectern-client/schema-entities";
import { loggerFor } from "../logger";
import { Errors, F } from "../utils";
import { DeepReadonly } from "deep-freeze";
import { FileType } from "./submission-api";
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
    const schemaResult = schemaManager.instance().process("registration", command.records);
    let unifiedSchemaErrors: DeepReadonly<ClinicalValidationError[]> = [];
    if (anyErrors(schemaResult.validationErrors)) {
      unifiedSchemaErrors = unifySchemaErrors(schemaResult, command.records);
      L.info(`found ${schemaResult.validationErrors.length} schema errors in registration attempt`);
    }

    // check the program id if it matches the authorized one
    // This check is used to validate the program Id along with the schema validations
    // to save extra round trips
    let programIdErrors: DeepReadonly<ClinicalValidationError[]> = [];
    command.records.forEach((r, index) => {
      const programIdError = dataValidator.usingInvalidProgramId(index, r, command.programId);
      programIdErrors = programIdErrors.concat(programIdError);
    });

    if (unifiedSchemaErrors.length > 0) {
      // if there are errors terminate the creation.
      return {
        registration: undefined,
        errors: unifiedSchemaErrors.concat(programIdErrors),
        successful: false
      };
    }
    const processedRecords = schemaResult.processedRecords;
    const registrationRecords = mapToRegistrationRecord(processedRecords);
    const filters: DeepReadonly<FindByProgramAndSubmitterFilter[]> = F(
      registrationRecords.map(rc => {
        return {
          programId: rc.programId,
          submitterId: rc.donorSubmitterId
        };
      })
    );

    // fetch related donor docs from the db
    let donorDocs = await donorDao.findByProgramAndSubmitterId(filters);
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
      command.programId,
      registrationRecords,
      donorsBySubmitterIdMap
    );

    if (errors.length > 0 || programIdErrors.length > 0) {
      L.info(`found ${errors.length} data errors in registration attempt`);
      return F({
        registration: undefined,
        stats: undefined,
        errors: errors.concat(programIdErrors),
        successful: false
      });
    }

    const stats = calculateUpdates(registrationRecords, donorsBySubmitterIdMap);

    // delete any existing active registration to replace it with the new one
    // we can only have 1 active registration per program
    const existingActivRegistration = await registrationRepository.findByProgramId(
      command.programId
    );

    if (existingActivRegistration != undefined && existingActivRegistration._id) {
      await registrationRepository.delete(existingActivRegistration._id);
    }

    // save the new registration object
    const registration = toActiveRegistration(command, registrationRecords, stats);
    const savedRegistration = await registrationRepository.create(registration);
    return F({
      registration: savedRegistration,
      errors: [],
      successful: true
    });
  };

  /**
   * find registration by program Id
   * @param programId string
   */
  export const findByProgramId = async (programId: string) => {
    return await registrationRepository.findByProgramId(programId);
  };

  /**
   * delete registration by registration Id
   * @param registrationId string
   * @param programId string
   */
  export const deleteRegistration = async (registrationId: string, programId: string) => {
    const registration = await registrationRepository.findById(registrationId);
    if (registration === undefined || registration.programId !== programId) {
      throw new Errors.NotFound(`no registration with id :${registrationId} found`);
    }
    await registrationRepository.delete(registrationId);
  };
  /**
   * upload donor
   * @param command SaveClinicalCommand
   */
  export const uploadClinical = async (
    command: SaveClinicalCommand
  ): Promise<CreateClinicalResult> => {
    let programIdErrors: DeepReadonly<ClinicalValidationError[]> = [];
    command.records.forEach((r, index) => {
      const programIdError = dataValidator.usingInvalidClinicalProgramId(
        index,
        r,
        command.programId
      );
      programIdErrors = programIdErrors.concat(programIdError);
    });
    const schemaResult = schemaManager.instance().process(command.clinicalType, command.records);
    if (schemaResult.validationErrors.length > 0) {
      const unifiedSchemaErrors = unifyClinicalSchemaErrors(schemaResult, command.records);
      return {
        clinicalData: undefined,
        errors: unifiedSchemaErrors.concat(programIdErrors),
        successful: false
      };
    }
    return {
      clinicalData: undefined,
      errors: [],
      successful: true
    };
  };

  /************* Private methods *************/

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

  const unifySchemaErrors = (
    result: SchemaProcessingResult,
    records: ReadonlyArray<DataRecord>
  ) => {
    const errorsList = new Array<ClinicalValidationError>();
    result.validationErrors.forEach(schemaErr => {
      errorsList.push({
        index: schemaErr.index,
        type: schemaErr.errorType,
        info: {
          ...schemaErr.info,
          value: records[schemaErr.index][schemaErr.fieldName],
          donorSubmitterId: records[schemaErr.index][FieldsEnum.submitter_donor_id],
          specimenSubmitterId: records[schemaErr.index][FieldsEnum.submitter_specimen_id],
          sampleSubmitterId: records[schemaErr.index][FieldsEnum.submitter_sample_id]
        },
        fieldName: schemaErr.fieldName as RegistrationRecordFields
      });
    });

    return F(errorsList);
  };

  const unifyClinicalSchemaErrors = (
    result: SchemaProcessingResult,
    records: ReadonlyArray<DataRecord>
  ) => {
    const errorsList = new Array<ClinicalValidationError>();
    result.validationErrors.forEach(schemaErr => {
      errorsList.push({
        index: schemaErr.index,
        type: schemaErr.errorType,
        info: {
          ...schemaErr.info,
          value: records[schemaErr.index][schemaErr.fieldName],
          donorSubmitterId: records[schemaErr.index][FieldsEnum.submitter_donor_id]
        },
        fieldName: schemaErr.fieldName
      });
    });
    return F(errorsList);
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

  const toActiveRegistration = (
    command: CreateRegistrationCommand,
    registrationRecords: ReadonlyArray<CreateRegistrationRecord>,
    stats: DeepReadonly<RegistrationStats>
  ): DeepReadonly<ActiveRegistration> => {
    return F({
      programId: command.programId,
      creator: command.creator,
      batchName: command.batchName,
      stats: stats,
      records: registrationRecords.map(r => {
        const record: Readonly<SubmittedRegistrationRecord> = {
          program_id: command.programId,
          submitter_donor_id: r.donorSubmitterId,
          gender: r.gender,
          submitter_specimen_id: r.specimenSubmitterId,
          specimen_type: r.specimenType,
          tumour_normal_designation: r.tumourNormalDesignation,
          submitter_sample_id: r.sampleSubmitterId,
          sample_type: r.sampleType
        };
        return record;
      })
    });
  };

  const anyErrors = (schemaErrors: DeepReadonly<SchemaValidationError[]>) => {
    return schemaErrors.length > 0 || schemaErrors.length > 0;
  };

  function mapToRegistrationRecord(records: DeepReadonly<TypedDataRecord[]>) {
    return F(
      records.map(r => {
        const rec: CreateRegistrationRecord = {
          programId: r[FieldsEnum.program_id] as string,
          donorSubmitterId: r[FieldsEnum.submitter_donor_id] as string,
          gender: r[FieldsEnum.gender] as string,
          specimenSubmitterId: r[FieldsEnum.submitter_specimen_id] as string,
          specimenType: r[FieldsEnum.specimen_type] as string,
          tumourNormalDesignation: r[FieldsEnum.tumour_normal_designation] as string,
          sampleSubmitterId: r[FieldsEnum.submitter_sample_id] as string,
          sampleType: r[FieldsEnum.sample_type] as string
        };
        return rec;
      })
    );
  }
}
