import * as dataValidator from './validation';
import { donorDao, FindByProgramAndSubmitterFilter } from '../clinical/donor-repo';
import _ from 'lodash';
import { registrationRepository } from './registration-repo';
import { Donor, DonorMap } from '../clinical/clinical-entities';
import {
  ActiveRegistration,
  SubmittedRegistrationRecord,
  RegistrationStats,
  SubmissionValidationError,
  CreateRegistrationRecord,
  CreateRegistrationCommand,
  CreateRegistrationResult,
  FieldsEnum,
  ClinicalSubmissionCommand,
  MultiClinicalSubmissionCommand,
  CreateSubmissionResult,
  SUBMISSION_STATE,
  ActiveClinicalSubmission,
  SubmittedClinicalRecord,
  SubmissionValidationUpdate,
  ClinicalTypeValidateResult,
  ClinicalEntities,
} from './submission-entities';
import * as schemaManager from '../lectern-client/schema-manager';
import {
  SchemaValidationError,
  TypedDataRecord,
  DataRecord,
  SchemaProcessingResult,
} from '../lectern-client/schema-entities';
import { loggerFor } from '../logger';
import { Errors, F } from '../utils';
import { DeepReadonly } from 'deep-freeze';
import { FileType } from './submission-api';
import { submissionRepository } from './submission-repo';
import { v1 as uuid } from 'uuid';
import { validateSubmissionData } from './validation';
const L = loggerFor(__filename);

const emptyStats = {
  dataErrors: [],
  dataUpdates: [],
  stats: {
    new: [],
    noUpdate: [],
    updated: [],
    errorsFound: [],
  },
};
export namespace operations {
  /**
   * This method creates an in progress registration after validating but doesn't create the donors in the donor collection
   * it overrides and deletes any previously uncomitted registrations.
   * @param command CreateRegistrationCommand the records to register,
   *  can contain new donors or existing donors but new samples.
   */
  export const createRegistration = async (
    command: CreateRegistrationCommand,
  ): Promise<CreateRegistrationResult> => {
    // delete any existing active registration to replace it with the new one
    // we can only have 1 active registration per program
    const existingActivRegistration = await registrationRepository.findByProgramId(
      command.programId,
    );

    if (existingActivRegistration != undefined && existingActivRegistration._id) {
      await registrationRepository.delete(existingActivRegistration._id);
    }

    const schemaResult = schemaManager.instance().process(FileType.REGISTRATION, command.records);
    let unifiedSchemaErrors: DeepReadonly<SubmissionValidationError[]> = [];
    if (anyErrors(schemaResult.validationErrors)) {
      unifiedSchemaErrors = unifySchemaErrors(FileType.REGISTRATION, schemaResult, command.records);
      L.info(`found ${schemaResult.validationErrors.length} schema errors in registration attempt`);
    }

    // check the program id if it matches the authorized one
    // This check is used to validate the program Id along with the schema validations
    // to save extra round trips
    let programIdErrors: DeepReadonly<SubmissionValidationError[]> = [];
    command.records.forEach((r, index) => {
      const programIdError = dataValidator.usingInvalidProgramId(
        FileType.REGISTRATION,
        index,
        r,
        command.programId,
      );
      programIdErrors = programIdErrors.concat(programIdError);
    });

    if (unifiedSchemaErrors.length > 0) {
      // if there are errors terminate the creation.
      return {
        registration: undefined,
        errors: unifiedSchemaErrors.concat(programIdErrors),
        successful: false,
      };
    }
    const processedRecords = schemaResult.processedRecords;
    const registrationRecords = mapToRegistrationRecord(processedRecords);
    const filters: DeepReadonly<FindByProgramAndSubmitterFilter[]> = F(
      registrationRecords.map(rc => {
        return {
          programId: rc.programId,
          submitterId: rc.donorSubmitterId,
        };
      }),
    );

    // fetch related donor docs from the db
    const donorsBySubmitterIdMap: DeepReadonly<DonorMap> = await getDonorsInProgram(filters);
    const { errors } = await dataValidator.validateRegistrationData(
      command.programId,
      registrationRecords,
      donorsBySubmitterIdMap,
    );

    if (errors.length > 0 || programIdErrors.length > 0) {
      L.info(`found ${errors.length} data errors in registration attempt`);
      return F({
        registration: undefined,
        stats: undefined,
        errors: errors.concat(programIdErrors),
        successful: false,
      });
    }

    const stats = calculateUpdates(registrationRecords, donorsBySubmitterIdMap);

    // save the new registration object
    const registration = toActiveRegistration(command, registrationRecords, stats);
    const savedRegistration = await registrationRepository.create(registration);
    return F({
      registration: savedRegistration,
      errors: [],
      successful: true,
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
   * find an active clinical submission by program Id
   * @param programId string
   */
  export const findSubmissionByProgramId = async (programId: string) => {
    return await submissionRepository.findByProgramId(programId);
  };

  /**
   * upload multiple clinical submissions
   * @param command SaveClinicalCommand
   */
  export const uploadMultipleClinical = async (
    command: MultiClinicalSubmissionCommand,
  ): Promise<CreateSubmissionResult> => {
    // get program or create new one
    let exsistingActiveSubmission = await submissionRepository.findByProgramId(command.programId);
    if (!exsistingActiveSubmission) {
      exsistingActiveSubmission = await submissionRepository.create({
        programId: command.programId,
        state: SUBMISSION_STATE.OPEN,
        version: uuid(),
        clinicalEntities: {},
      });
    }
    const updatedClinicalEntites: ClinicalEntities = {};
    // extract clinicalEntities from existing submission and clear stats & dataErrors/Updates
    for (const clinicalType in exsistingActiveSubmission.clinicalEntities) {
      updatedClinicalEntites[clinicalType] = {
        ...exsistingActiveSubmission.clinicalEntities[clinicalType],
        ...emptyStats,
      };
    }

    const schemaErrors: { [k: string]: SubmissionValidationError[] } = {}; // object to store all errors for entity
    for (const clinicalType in command.newClinicalEntities) {
      const newClinicalEnity = command.newClinicalEntities[clinicalType];
      const { schemaErrorsTemp, processedRecords } = await checkClinicalEntity({
        records: newClinicalEnity.records,
        programId: command.programId,
        clinicalType: clinicalType,
      });
      if (schemaErrorsTemp.length > 0) {
        // store errors found and remove clinical type from clinical entities
        schemaErrors[clinicalType] = schemaErrorsTemp;
        delete updatedClinicalEntites[clinicalType];
      } else {
        // update or add entity
        updatedClinicalEntites[clinicalType] = {
          ...command.newClinicalEntities[clinicalType],
          ...emptyStats,
        };
      }
    }
    const newActiveSubmission: ActiveClinicalSubmission = {
      programId: command.programId,
      state: SUBMISSION_STATE.OPEN,
      version: '', // version is irrelevant here, repo will set it
      clinicalEntities: updatedClinicalEntites,
    };
    // insert into database
    const updated = await submissionRepository.updateSubmissionWithVersion(
      command.programId,
      exsistingActiveSubmission.version,
      newActiveSubmission,
    );

    return {
      submission: updated,
      schemaErrors: schemaErrors,
      successful: Object.keys(schemaErrors).length === 0,
    };
  };

  /**
   * validate active submission
   * @param programId String
   * @param versionId String
   */
  export const validateMultipleClinical = async (
    programId: string,
    versionId: string,
  ): Promise<CreateSubmissionResult> => {
    const exsistingActiveSubmission = await submissionRepository.findByProgramId(programId);
    if (!exsistingActiveSubmission || exsistingActiveSubmission.version !== versionId) {
      throw new Errors.NotFound(
        `No active submission found with programId: ${programId} & versionId: ${versionId}`,
      );
    }
    if (exsistingActiveSubmission.state !== SUBMISSION_STATE.OPEN) {
      return {
        submission: exsistingActiveSubmission,
        schemaErrors: {},
        successful: true,
      };
    }
    // map donors(via donorId) to their relevant records
    const newDonorDataMap: {
      [donoSubmitterId: string]: { [clinicalType: string]: SubmittedClinicalRecord };
    } = {};
    const filters: FindByProgramAndSubmitterFilter[] = [];
    for (const clinicalType in exsistingActiveSubmission.clinicalEntities) {
      const clinicalEnity = exsistingActiveSubmission.clinicalEntities[clinicalType];
      clinicalEnity.records.forEach((rc, index) => {
        const donorId = rc[FieldsEnum.submitter_donor_id];
        filters.push({
          programId: rc[FieldsEnum.program_id],
          submitterId: donorId,
        });
        if (!newDonorDataMap[donorId]) {
          newDonorDataMap[donorId] = {};
        }
        newDonorDataMap[donorId][clinicalType] = {
          ...rc,
          submitter_donor_id: donorId,
          program_id: rc[FieldsEnum.program_id],
          index: index,
        };
      });
    }
    const relevantDonorsMap = await getDonorsInProgram(filters);
    const validateResult: ClinicalTypeValidateResult = await validateSubmissionData(
      newDonorDataMap,
      relevantDonorsMap,
    );

    // update data errors/updates and stats
    let invalid: boolean = false;
    const validatedClinicalEntities = _.cloneDeep(
      exsistingActiveSubmission.clinicalEntities,
    ) as ClinicalEntities;
    for (const clinicalType in validateResult) {
      validatedClinicalEntities[clinicalType].stats = validateResult[clinicalType].stats;

      const updates = validateResult[clinicalType].dataUpdates as SubmissionValidationUpdate[];
      validatedClinicalEntities[clinicalType].dataUpdates = updates;

      const errors = validateResult[clinicalType].dataErrors as SubmissionValidationError[];
      invalid = invalid || (errors && errors.length > 0);
      validatedClinicalEntities[clinicalType].dataErrors = errors;
    }

    const newActiveSubmission: ActiveClinicalSubmission = {
      programId: exsistingActiveSubmission.programId,
      state: invalid ? SUBMISSION_STATE.INVALID : SUBMISSION_STATE.VALID,
      version: '', // version is irrelevant here, repo will set it
      clinicalEntities: validatedClinicalEntities,
    };

    // insert into database
    const updated = await submissionRepository.updateSubmissionWithVersion(
      programId,
      exsistingActiveSubmission.version,
      newActiveSubmission,
    );

    return {
      submission: updated,
      schemaErrors: {},
      successful: !invalid,
    };
  };

  /************* Private methods *************/

  const addNewDonorToStats = (
    stats: RegistrationStats,
    newDonor: CreateRegistrationRecord,
    index: number,
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
    index: number,
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
    index: number,
  ) => {
    if (!stats.newSampleIds[newDonor.sampleSubmitterId]) {
      stats.newSampleIds[newDonor.sampleSubmitterId] = [index];
      return;
    }
    stats.newSampleIds[newDonor.sampleSubmitterId].push(index);
    return;
  };

  const unifySchemaErrors = (
    type: FileType,
    result: SchemaProcessingResult,
    records: ReadonlyArray<DataRecord>,
  ) => {
    const errorsList = new Array<SubmissionValidationError>();
    result.validationErrors.forEach(schemaErr => {
      errorsList.push({
        index: schemaErr.index,
        type: schemaErr.errorType,
        info: getInfoObject(type, schemaErr, records[schemaErr.index]),
        fieldName: schemaErr.fieldName,
      });
    });
    return F(errorsList);
  };
  const getInfoObject = (
    type: FileType,
    schemaErr: DeepReadonly<SchemaValidationError>,
    record: DeepReadonly<DataRecord>,
  ) => {
    switch (type) {
      case FileType.REGISTRATION: {
        return F({
          ...schemaErr.info,
          value: record[schemaErr.fieldName],
          donorSubmitterId: record[FieldsEnum.submitter_donor_id],
          specimenSubmitterId: record[FieldsEnum.submitter_specimen_id],
          sampleSubmitterId: record[FieldsEnum.submitter_sample_id],
        });
      }
      default: {
        return F({
          ...schemaErr.info,
          value: record[schemaErr.fieldName],
          donorSubmitterId: record[FieldsEnum.submitter_donor_id],
        });
      }
    }
  };
  const calculateUpdates = (
    records: DeepReadonly<CreateRegistrationRecord[]>,
    donorsBySubmitterIdMap: DeepReadonly<DonorMap>,
  ) => {
    const stats: RegistrationStats = {
      newDonorIds: {},
      newSpecimenIds: {},
      newSampleIds: {},
      alreadyRegistered: {},
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
        s => s.submitterId === nd.specimenSubmitterId,
      );
      if (!existingSpecimen) {
        addNewSpecimenToStats(stats, nd, index);
        addNewSampleToStats(stats, nd, index);
        return;
      }

      const existingSample = existingSpecimen.samples.find(
        sa => sa.submitterId === nd.sampleSubmitterId,
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
    stats: DeepReadonly<RegistrationStats>,
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
          specimen_tissue_source: r.specimenTissueSource,
          tumour_normal_designation: r.tumourNormalDesignation,
          submitter_sample_id: r.sampleSubmitterId,
          sample_type: r.sampleType,
        };
        return record;
      }),
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
          specimenTissueSource: r[FieldsEnum.specimen_tissue_source] as string,
          tumourNormalDesignation: r[FieldsEnum.tumour_normal_designation] as string,
          sampleSubmitterId: r[FieldsEnum.submitter_sample_id] as string,
          sampleType: r[FieldsEnum.sample_type] as string,
        };
        return rec;
      }),
    );
  }

  const checkClinicalEntity = async (command: ClinicalSubmissionCommand): Promise<any> => {
    let errors: SubmissionValidationError[] = [];
    const schemaResult = schemaManager.instance().process(command.clinicalType, command.records);
    if (schemaResult.validationErrors.length > 0) {
      const unifiedSchemaErrors = unifySchemaErrors(
        command.clinicalType as FileType,
        schemaResult,
        command.records,
      );
      errors = errors.concat(unifiedSchemaErrors);
    }
    command.records.forEach((r, index) => {
      const programIdErrors = dataValidator.usingInvalidProgramId(
        command.clinicalType as FileType,
        index,
        r,
        command.programId,
      );
      errors = errors.concat(programIdErrors);
    });
    return {
      schemaErrorsTemp: errors,
      processedRecords: schemaResult.processedRecords,
    };
  };

  const getDonorsInProgram = async (
    filters: DeepReadonly<FindByProgramAndSubmitterFilter[]>,
  ): Promise<DeepReadonly<DonorMap>> => {
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
    return F(donorByIdMapTemp);
  };
}
