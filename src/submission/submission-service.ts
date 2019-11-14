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
  ClearSubmissionCommand,
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
  ClinicalSubmissionModifierCommand,
  RegistrationStat,
  NewClinicalEntity,
  SubmissionBatchError,
  SubmissionBatchErrorTypes,
  ValidateSubmissionResult,
  NewClinicalEntities,
  ClinicalEntityType,
  BatchNameRegex,
} from './submission-entities';
import * as schemaManager from './schema-manager';
import {
  SchemaValidationError,
  TypedDataRecord,
  DataRecord,
  SchemaProcessingResult,
  SchemaValidationErrorTypes,
} from '../lectern-client/schema-entities';
import { loggerFor } from '../logger';
import { Errors, F, isStringMatchRegex } from '../utils';
import { DeepReadonly } from 'deep-freeze';
import { submissionRepository } from './submission-repo';
import { v1 as uuid } from 'uuid';
import { validateSubmissionData, checkUniqueRecords } from './validation';
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

    const schemaResult = schemaManager
      .instance()
      .process(ClinicalEntityType.REGISTRATION, command.records);
    let unifiedSchemaErrors: DeepReadonly<SubmissionValidationError[]> = [];
    if (anyErrors(schemaResult.validationErrors)) {
      unifiedSchemaErrors = unifySchemaErrors(
        ClinicalEntityType.REGISTRATION,
        schemaResult,
        command.records,
      );
      L.info(`found ${schemaResult.validationErrors.length} schema errors in registration attempt`);
    }

    // check the program id if it matches the authorized one
    // This check is used to validate the program Id along with the schema validations
    // to save extra round trips
    let programIdErrors: DeepReadonly<SubmissionValidationError[]> = [];
    command.records.forEach((r, index) => {
      const programIdError = dataValidator.usingInvalidProgramId(
        ClinicalEntityType.REGISTRATION,
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
    const schemaVersion = schemaManager.instance().getCurrent().version;
    const registration = toActiveRegistration(command, registrationRecords, stats, schemaVersion);
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
   * clear clinical entities in submission
   * @param command ClearSubmissionCommand
   */
  export const clearSubmissionData = async (command: ClearSubmissionCommand) => {
    // Get active submission
    const activeSubmission = await submissionRepository.findByProgramId(command.programId);

    if (activeSubmission === undefined) {
      throw new Errors.NotFound('No active submission data found for this program.');
    } else if (activeSubmission.version !== command.versionId) {
      throw new Errors.InvalidArgument(
        'Version ID provided does not match the latest submission version for this program.',
      );
    } else if (activeSubmission.state === SUBMISSION_STATE.PENDING_APPROVAL) {
      // confirm that the state is VALID
      throw new Errors.StateConflict(
        'Active submission is in PENDING_APPROVAL state and cannot be modified.',
      );
    } else {
      // Update clinical entities from the active submission
      const updatedClinicalEntities: ClinicalEntities = {};
      if (command.fileType !== 'all') {
        for (const clinicalType in activeSubmission.clinicalEntities) {
          if (clinicalType !== command.fileType) {
            updatedClinicalEntities[clinicalType] = {
              ...activeSubmission.clinicalEntities[clinicalType],
              ...emptyStats,
            };
          }
        }
      }
      const newActiveSubmission: ActiveClinicalSubmission = {
        programId: command.programId,
        state: SUBMISSION_STATE.OPEN,
        version: '', // version is irrelevant here, repo will set it
        clinicalEntities: updatedClinicalEntities,
        updatedBy: command.updater,
      };
      // insert into database
      const updated = await submissionRepository.updateSubmissionWithVersion(
        command.programId,
        activeSubmission.version,
        newActiveSubmission,
      );
      return updated;
    }
  };

  /**
   * upload multiple clinical submissions
   * Three validation steps before upload is done:
   * 1. mapping batchName to clinicalType => can find batchError
   * 2. check headers (if provided) => can find batchError
   * 3. schemaValidation, done by lectern-client => can return schemaError
   * @param command MultiClinicalSubmissionCommand
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
        updatedBy: command.updater,
      });
    }

    // Step 1 map dataArray to entitesMap
    const { newClinicalEntitesMap, dataToEntityMapErrors } = mapClinicalDataToEntity(
      command.newClinicalData,
      Object.values(ClinicalEntityType).filter(type => type !== ClinicalEntityType.REGISTRATION),
    );
    // Step 2 filter entites with invalid fieldNames
    const { filteredClinicalEntites, fieldNameErrors } = ckeckEntityFieldNames(
      newClinicalEntitesMap,
    );

    const updatedClinicalEntites: ClinicalEntities = clearClinicalEnitytStats(
      exsistingActiveSubmission.clinicalEntities,
    );
    const createdAt: DeepReadonly<Date> = new Date();
    const schemaErrors: { [k: string]: SubmissionValidationError[] } = {}; // object to store all errors for entity
    for (const [clinicalType, newClinicalEnity] of Object.entries(filteredClinicalEntites)) {
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
          batchName: newClinicalEnity.batchName,
          creator: newClinicalEnity.creator,
          createdAt: createdAt,
          records: processedRecords,
          ...emptyStats,
        };
      }
    }
    const newActiveSubmission: ActiveClinicalSubmission = {
      programId: command.programId,
      state: SUBMISSION_STATE.OPEN,
      version: '', // version is irrelevant here, repo will set it
      clinicalEntities: updatedClinicalEntites,
      updatedBy: command.updater,
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
      batchErrors: [...dataToEntityMapErrors, ...fieldNameErrors],
    };
  };

  /**
   * validate active submission
   * @param command ClinicalSubmissionModifierCommand
   */
  export const validateMultipleClinical = async (
    command: Readonly<ClinicalSubmissionModifierCommand>,
  ): Promise<ValidateSubmissionResult> => {
    const exsistingActiveSubmission = await submissionRepository.findByProgramId(command.programId);
    if (!exsistingActiveSubmission || exsistingActiveSubmission.version !== command.versionId) {
      throw new Errors.NotFound(
        `No active submission found with programId: ${command.programId} & versionId: ${command.versionId}`,
      );
    }
    if (
      exsistingActiveSubmission.state !== SUBMISSION_STATE.OPEN ||
      _.isEmpty(exsistingActiveSubmission.clinicalEntities)
    ) {
      return {
        submission: exsistingActiveSubmission,
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
          programId: command.programId,
          submitterId: donorId,
        });
        if (!newDonorDataMap[donorId]) {
          newDonorDataMap[donorId] = {};
        }
        newDonorDataMap[donorId][clinicalType] = {
          ...rc,
          submitter_donor_id: donorId,
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
      updatedBy: command.updater,
    };

    // insert into database
    const updated = await submissionRepository.updateSubmissionWithVersion(
      command.programId,
      exsistingActiveSubmission.version,
      newActiveSubmission,
    );

    return {
      submission: updated,
      successful: !invalid,
    };
  };

  /**
   * reopen active submission and clear stats for entities
   * @param command ClinicalSubmissionModifierCommand
   */
  export const reopenClinicalSubmission = async (command: ClinicalSubmissionModifierCommand) => {
    const exsistingActiveSubmission = await submissionRepository.findByProgramId(command.programId);
    if (!exsistingActiveSubmission || exsistingActiveSubmission.version !== command.versionId) {
      throw new Errors.NotFound(
        `No active submission found with programId: ${command.programId} & versionId: ${command.versionId}`,
      );
    }
    if (exsistingActiveSubmission.state !== SUBMISSION_STATE.PENDING_APPROVAL) {
      throw new Errors.StateConflict(
        'Active submission does not have state PENDING_APPROVAL and cannot be reopened.',
      );
    }
    // remove stats from clinical entities
    const updatedClinicalEntites: ClinicalEntities = clearClinicalEnitytStats(
      exsistingActiveSubmission.clinicalEntities,
    );

    const reopenedActiveSubmission: ActiveClinicalSubmission = {
      programId: command.programId,
      state: SUBMISSION_STATE.OPEN,
      version: command.versionId, // version is irrelevant here, repo will set it
      clinicalEntities: updatedClinicalEntites,
      updatedBy: command.updater,
    };

    return await submissionRepository.updateSubmissionWithVersion(
      command.programId,
      command.versionId,
      reopenedActiveSubmission,
    );
  };

  /* *************** *
   * Private Methods
   * *************** */

  const clearClinicalEnitytStats = (
    clinicalEntities: DeepReadonly<ClinicalEntities>,
  ): ClinicalEntities => {
    const statClearedClinicalEntites: ClinicalEntities = {};
    Object.entries(clinicalEntities).forEach(([clinicalType, clinicalEntity]) => {
      statClearedClinicalEntites[clinicalType] = {
        ...clinicalEntity,
        ...emptyStats,
      };
    });
    return statClearedClinicalEntites;
  };

  const addNewDonorToStats = (
    stats: RegistrationStats,
    newDonor: CreateRegistrationRecord,
    index: number,
  ) => {
    addRowNumberToStats(stats.newDonorIds, newDonor.donorSubmitterId, index);
  };

  const addNewSpecimenToStats = (
    stats: RegistrationStats,
    newDonor: CreateRegistrationRecord,
    index: number,
  ) => {
    addRowNumberToStats(stats.newSpecimenIds, newDonor.specimenSubmitterId, index);
  };

  const addNewSampleToStats = (
    stats: RegistrationStats,
    newDonor: CreateRegistrationRecord,
    index: number,
  ) => {
    addRowNumberToStats(stats.newSampleIds, newDonor.sampleSubmitterId, index);
  };

  const unifySchemaErrors = (
    type: ClinicalEntityType,
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
        message: schemaErr.message,
      });
    });
    return F(errorsList);
  };
  const getInfoObject = (
    type: ClinicalEntityType,
    schemaErr: DeepReadonly<SchemaValidationError>,
    record: DeepReadonly<DataRecord>,
  ) => {
    switch (type) {
      case ClinicalEntityType.REGISTRATION: {
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

  const addRowNumberToStats = (
    statsArray: RegistrationStat,
    submitterId: string,
    rowNum: number,
  ) => {
    for (const s of statsArray) {
      if (s.submitterId == submitterId) {
        s.rowNumbers.push(rowNum);
        return;
      }
    }
    statsArray.push({
      submitterId,
      rowNumbers: [rowNum],
    });
  };

  const calculateUpdates = (
    records: DeepReadonly<CreateRegistrationRecord[]>,
    donorsBySubmitterIdMap: DeepReadonly<DonorMap>,
  ) => {
    const stats: RegistrationStats = {
      newDonorIds: [],
      newSpecimenIds: [],
      newSampleIds: [],
      alreadyRegistered: [],
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
      addRowNumberToStats(stats.alreadyRegistered, nd.donorSubmitterId, index);
      return;
    });

    return F(stats);
  };

  const toActiveRegistration = (
    command: CreateRegistrationCommand,
    registrationRecords: ReadonlyArray<CreateRegistrationRecord>,
    stats: DeepReadonly<RegistrationStats>,
    schemaVersion: string,
  ): DeepReadonly<ActiveRegistration> => {
    return F({
      programId: command.programId,
      creator: command.creator,
      batchName: command.batchName,
      stats: stats,
      schemaVersion: schemaVersion,
      records: registrationRecords.map(r => {
        const record: Readonly<SubmittedRegistrationRecord> = {
          [FieldsEnum.program_id]: command.programId,
          [FieldsEnum.submitter_donor_id]: r.donorSubmitterId,
          [FieldsEnum.gender]: r.gender,
          [FieldsEnum.submitter_specimen_id]: r.specimenSubmitterId,
          [FieldsEnum.specimen_tissue_source]: r.specimenTissueSource,
          [FieldsEnum.tumour_normal_designation]: r.tumourNormalDesignation,
          [FieldsEnum.submitter_sample_id]: r.sampleSubmitterId,
          [FieldsEnum.sample_type]: r.sampleType,
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
    // check records are unique
    let errors: SubmissionValidationError[] = checkUniqueRecords(
      command.clinicalType as ClinicalEntityType,
      command.records,
    );

    const schemaResult = schemaManager.instance().process(command.clinicalType, command.records);
    if (schemaResult.validationErrors.length > 0) {
      const unifiedSchemaErrors = unifySchemaErrors(
        command.clinicalType as ClinicalEntityType,
        schemaResult,
        command.records,
      );
      errors = errors.concat(unifiedSchemaErrors);
    }
    return {
      schemaErrorsTemp: errors,
      processedRecords: schemaResult.processedRecords,
    };
  };

  const getDonorsInProgram = async (
    filters: DeepReadonly<FindByProgramAndSubmitterFilter[]>,
  ): Promise<DeepReadonly<DonorMap>> => {
    if (filters.length === 0) {
      return {};
    }
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

  const mapClinicalDataToEntity = (
    clinicalData: ReadonlyArray<NewClinicalEntity>,
    expectedClinicalEntites: ReadonlyArray<ClinicalEntityType>,
  ): DeepReadonly<{
    newClinicalEntitesMap: NewClinicalEntities;
    dataToEntityMapErrors: Array<SubmissionBatchError>;
  }> => {
    const mutableClinicalData = [...clinicalData];
    const dataToEntityMapErrors: Array<SubmissionBatchError> = [];
    const newClinicalEntitesMap: { [clinicalType: string]: NewClinicalEntity } = {};

    // check for double files and map files to clinical type
    expectedClinicalEntites.forEach(clinicalType => {
      const dataMatchToType = _.remove(mutableClinicalData, clinicalData =>
        isStringMatchRegex(BatchNameRegex[clinicalType], clinicalData.batchName),
      );

      if (dataMatchToType.length > 1) {
        dataToEntityMapErrors.push({
          msg: `Found multiple files of ${clinicalType} type`,
          batchNames: dataMatchToType.map(data => data.batchName),
          code: SubmissionBatchErrorTypes.MULTIPLE_TYPED_FILES,
        });
      } else if (dataMatchToType.length == 1) {
        newClinicalEntitesMap[clinicalType] = dataMatchToType[0];
      }
    });

    if (mutableClinicalData.length > 0) {
      dataToEntityMapErrors.push({
        msg: `Invalid file(s), must start with entity and have .tsv extension (e.g. donor*.tsv)`,
        batchNames: mutableClinicalData.map(data => data.batchName),
        code: SubmissionBatchErrorTypes.INVALID_FILE_NAME,
      });
    }

    return F({ newClinicalEntitesMap, dataToEntityMapErrors });
  };

  const ckeckEntityFieldNames = (newClinicalEntitesMap: DeepReadonly<NewClinicalEntities>) => {
    const fieldNameErrors: SubmissionBatchError[] = [];
    const filteredClinicalEntites: NewClinicalEntities = {};
    for (const [clinicalType, newClinicalEnity] of Object.entries(newClinicalEntitesMap)) {
      if (!newClinicalEnity.fieldNames) {
        continue;
      }
      const commonFieldNamesSet = new Set(newClinicalEnity.fieldNames);
      const clinicalFieldNamesByPriorityMap = schemaManager
        .instance()
        .getSubSchemaFieldNamesWithPriority(clinicalType);
      const missingFields: string[] = [];

      clinicalFieldNamesByPriorityMap.required.forEach(requriedField => {
        if (!commonFieldNamesSet.has(requriedField)) {
          missingFields.push(requriedField);
        } else {
          commonFieldNamesSet.delete(requriedField);
        }
      });
      clinicalFieldNamesByPriorityMap.optional.forEach(optionalField =>
        commonFieldNamesSet.delete(optionalField),
      );

      const unknownFields = Array.from(commonFieldNamesSet); // remaining are unknown

      if (missingFields.length === 0 && unknownFields.length === 0) {
        filteredClinicalEntites[clinicalType] = { ...newClinicalEnity };
        continue;
      }

      if (missingFields.length > 0)
        fieldNameErrors.push({
          msg: `Missing required headers: [${missingFields.join('], [')}]`,
          batchNames: [newClinicalEnity.batchName],
          code: SchemaValidationErrorTypes.MISSING_REQUIRED_FIELD,
        });
      if (unknownFields.length > 0)
        fieldNameErrors.push({
          msg: `Found unknown headers: [${unknownFields.join('], [')}]`,
          batchNames: [newClinicalEnity.batchName],
          code: SchemaValidationErrorTypes.UNRECOGNIZED_FIELD,
        });
    }
    return { filteredClinicalEntites, fieldNameErrors };
  };
}
