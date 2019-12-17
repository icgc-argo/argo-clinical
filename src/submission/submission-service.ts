import * as dataValidator from './validation-clinical/validation';
import { donorDao, FindByProgramAndSubmitterFilter } from '../clinical/donor-repo';
import _ from 'lodash';
import { registrationRepository } from './registration-repo';
import { Donor, DonorMap, Specimen, Sample, SchemaMetadata } from '../clinical/clinical-entities';
import {
  ActiveRegistration,
  SubmittedRegistrationRecord,
  RegistrationStats,
  SubmissionValidationError,
  CreateRegistrationRecord,
  CreateRegistrationCommand,
  CreateRegistrationResult,
  ClearSubmissionCommand,
  SampleRegistrationFieldsEnum,
  ClinicalSubmissionCommand,
  MultiClinicalSubmissionCommand,
  CreateSubmissionResult,
  SUBMISSION_STATE,
  ActiveClinicalSubmission,
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
  ClinicalEntitySchemaNames,
  BatchNameRegex,
  ClinicalSubmissionRecordsByDonorIdMap,
  RevalidateClinicalSubmissionCommand,
} from './submission-entities';
import * as schemaManager from './schema/schema-manager';
import {
  SchemaValidationError,
  TypedDataRecord,
  DataRecord,
  SchemaProcessingResult,
  SchemasDictionary,
} from '../lectern-client/schema-entities';
import { loggerFor } from '../logger';
import { Errors, F, isStringMatchRegex, toString, isEmptyString } from '../utils';
import { DeepReadonly } from 'deep-freeze';
import { submissionRepository } from './submission-repo';
import { v1 as uuid } from 'uuid';
import { validateSubmissionData, checkUniqueRecords } from './validation-clinical/validation';
import { batchErrorMessage } from './submission-error-messages';
import {
  ClinicalSubmissionRecordsOperations,
  usingInvalidProgramId,
} from './validation-clinical/utils';
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
    const existingActivRegistration = await registrationRepository.findByProgramId(
      command.programId,
    );

    const preCheckError = preCheckRegistrationFields(command);
    if (preCheckError) {
      return {
        registration: existingActivRegistration,
        batchErrors: preCheckError,
        successful: false,
      };
    }

    // delete any existing active registration to replace it with the new one
    // we can only have 1 active registration per program
    if (existingActivRegistration != undefined && existingActivRegistration._id) {
      await registrationRepository.delete(existingActivRegistration._id);
    }

    let unifiedSchemaErrors: DeepReadonly<SubmissionValidationError[]> = [];
    const validRecordsAccumulator: any[] = [];
    // check the program id if it matches the authorized one
    // This check is used to validate the program Id along with the schema validations
    // to save extra round trips
    command.records.forEach((r, index) => {
      const schemaResult = schemaManager
        .instance()
        .process(ClinicalEntitySchemaNames.REGISTRATION, r, index);

      if (anyErrors(schemaResult.validationErrors)) {
        unifiedSchemaErrors = unifiedSchemaErrors.concat(
          unifySchemaErrors(ClinicalEntitySchemaNames.REGISTRATION, schemaResult, command.records),
        );
      }

      const programIdError = usingInvalidProgramId(
        ClinicalEntitySchemaNames.REGISTRATION,
        index,
        r,
        command.programId,
      );

      unifiedSchemaErrors = unifiedSchemaErrors.concat(programIdError);
      validRecordsAccumulator.push(schemaResult.processedRecord);
    });

    if (!_.isEmpty(unifiedSchemaErrors)) {
      L.info(`found ${unifiedSchemaErrors.length} schema errors in registration attempt`);
      // if there are errors terminate the creation.
      return {
        registration: undefined,
        errors: unifiedSchemaErrors,
        successful: false,
      };
    }

    const registrationRecords = mapToRegistrationRecord(validRecordsAccumulator);
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

    if (errors.length > 0) {
      L.info(`found ${errors.length} data errors in registration attempt`);
      return F({
        registration: undefined,
        stats: undefined,
        errors: errors,
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
    }

    if (activeSubmission.version !== command.versionId) {
      throw new Errors.InvalidArgument(
        'Version ID provided does not match the latest submission version for this program.',
      );
    }

    if (activeSubmission.state === SUBMISSION_STATE.PENDING_APPROVAL) {
      // confirm that the state is VALID
      throw new Errors.StateConflict(
        'Active submission is in PENDING_APPROVAL state and cannot be modified.',
      );
    }

    // Update clinical entities from the active submission
    const updatedClinicalEntities: ClinicalEntities = {};
    if (command.fileType !== 'all') {
      for (const clinicalType in activeSubmission.clinicalEntities) {
        if (clinicalType !== command.fileType) {
          updatedClinicalEntities[clinicalType] = {
            ...activeSubmission.clinicalEntities[clinicalType],
            schemaErrors: [],
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
    const updated = await updateSubmissionWithVersionOrDeleteEmpty(
      command.programId,
      activeSubmission.version,
      newActiveSubmission,
    );
    return updated;
  };

  export const findActiveClinicalSubmissions = async () => {
    return await submissionRepository.findAll();
  };

  /**
   * upload multiple clinical submissions
   * Three validation steps before upload is done:
   * 1. mapping batchName to clinicalType => can find batchError
   * 2. check headers (if provided) => can find batchError
   * 3. schemaValidation, done by lectern-client => can return schemaError
   * @param command MultiClinicalSubmissionCommand
   * @param targetSchema this is needed for migration case where we target new schema
   *                      if not provided, the default is the current schema.
   */
  export const submitMultiClinicalBatches = async (
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
      Object.values(ClinicalEntitySchemaNames).filter(
        type => type !== ClinicalEntitySchemaNames.REGISTRATION,
      ),
    );

    // Step 2 filter entites with invalid fieldNames
    const { filteredClinicalEntites, fieldNameErrors } = checkEntityFieldNames(
      newClinicalEntitesMap,
    );

    const updatedClinicalEntites: ClinicalEntities = clearClinicalEnitytStats(
      exsistingActiveSubmission.clinicalEntities,
    );

    const createdAt: DeepReadonly<Date> = new Date();

    // object to store all errors for entity
    const schemaErrors: { [k: string]: SubmissionValidationError[] } = {};

    for (const [clinicalType, newClinicalEnity] of Object.entries(filteredClinicalEntites)) {
      const { schemaErrorsTemp, processedRecords } = await checkClinicalEntity(
        {
          records: newClinicalEnity.records,
          programId: command.programId,
          clinicalType: clinicalType,
        },
        schemaManager.instance().getCurrent(),
      );

      // because there was a requirement to not keep an open empty submission
      // we have to return a fake submission object in case there are schema errors
      // after the update/delete submission is callled below
      if (schemaErrorsTemp.length > 0) {
        // store errors found and remove clinical type from clinical entities
        schemaErrors[clinicalType] = schemaErrorsTemp;
        delete updatedClinicalEntites[clinicalType];
        continue;
      }

      // update or add entity
      updatedClinicalEntites[clinicalType] = {
        batchName: newClinicalEnity.batchName,
        creator: newClinicalEnity.creator,
        createdAt: createdAt,
        schemaErrors: [],
        records: processedRecords as any,
        ...emptyStats,
      };
    }

    const newActiveSubmission: ActiveClinicalSubmission = {
      programId: command.programId,
      state: SUBMISSION_STATE.OPEN,
      version: '', // version is irrelevant here, repo will set it
      clinicalEntities: updatedClinicalEntites,
      updatedBy: command.updater,
    };

    // insert into database
    let updated = (await updateSubmissionWithVersionOrDeleteEmpty(
      command.programId,
      exsistingActiveSubmission.version,
      newActiveSubmission,
    )) as ActiveClinicalSubmission;

    if (updated === undefined) {
      // this is to be able to put the schema errors in the clinical entities
      // without having to save an empty submission.
      updated = {
        clinicalEntities: {},
        programId: undefined,
        state: undefined,
        version: undefined,
        updatedBy: undefined,
      } as any;
    }
    // put the schema errors in each clinical entity
    for (const clinicalType in schemaErrors) {
      updated.clinicalEntities[clinicalType] = {} as any;
      updated.clinicalEntities[clinicalType].schemaErrors = schemaErrors[clinicalType];
    }

    return {
      submission: updated,
      successful:
        Object.keys(schemaErrors).length === 0 &&
        dataToEntityMapErrors.length === 0 &&
        fieldNameErrors.length === 0,
      batchErrors: [...dataToEntityMapErrors, ...fieldNameErrors],
    };
  };

  /**
   * checks existing submission records against a target schema
   * @param command RevalidateClinicalSubmissionCommand
   * @param targetSchema the schema that the submission records will be validated with.
   */
  export const revalidateClinicalSubmission = async (
    command: RevalidateClinicalSubmissionCommand,
    targetSchema: SchemasDictionary,
    dryRun = false,
  ): Promise<CreateSubmissionResult> => {
    // get program or create new one
    const exsistingActiveSubmission = await submissionRepository.findByProgramId(command.programId);
    if (!exsistingActiveSubmission) {
      throw new Error('trying to migrate non existing submission');
    }

    const existingClinicalEntities = _.cloneDeep(
      exsistingActiveSubmission.clinicalEntities,
    ) as ClinicalEntities;
    const schemaErrors: { [k: string]: SubmissionValidationError[] } = {}; // object to store all errors for entity

    for (const [clinicalType, clinicalEntityBatch] of Object.entries(existingClinicalEntities)) {
      const { schemaErrorsTemp: clinicalEntitySchemaErrors } = await checkClinicalEntity(
        {
          records: clinicalEntityBatch.records.map(prepareForSchemaReProcessing),
          programId: command.programId,
          clinicalType: clinicalType,
        },
        targetSchema,
      );

      // if it doesn't pass the new schema
      if (clinicalEntitySchemaErrors.length > 0) {
        // store errors found and remove clinical type from clinical entities
        schemaErrors[clinicalType] = clinicalEntitySchemaErrors;
        existingClinicalEntities[clinicalType].schemaErrors = clinicalEntitySchemaErrors;
        continue;
      }
    }

    const successful = Object.keys(schemaErrors).length === 0;
    let state = exsistingActiveSubmission.state;

    // special state to indicate that the submission is invalid my migration process.
    if (!successful) {
      state = SUBMISSION_STATE.INVALID_BY_MIGRATION;
    }

    const newActiveSubmission: ActiveClinicalSubmission = {
      programId: command.programId,
      state: state,
      version: '', // version is irrelevant here, repo will set it
      clinicalEntities: existingClinicalEntities,
      updatedBy: exsistingActiveSubmission.updatedBy,
    };

    // if dry run, then we don't actually want to update the submission we just return the result now
    if (dryRun) {
      return {
        submission: newActiveSubmission,
        successful: successful,
        batchErrors: [],
      };
    }

    // update the submission, it will not delete since we keep all clinical entities
    const updated = await updateSubmissionWithVersionOrDeleteEmpty(
      command.programId,
      exsistingActiveSubmission.version,
      newActiveSubmission,
    );

    return {
      submission: updated,
      successful: successful,
      batchErrors: [],
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
    // map records to relevant submitter_donor_id
    const clinicalSubmissionRecords: ClinicalSubmissionRecordsByDonorIdMap = {};
    const filters: FindByProgramAndSubmitterFilter[] = [];
    // map records to submitterDonorId and build filters
    for (const clinicalType in exsistingActiveSubmission.clinicalEntities) {
      const clinicalEnity = exsistingActiveSubmission.clinicalEntities[clinicalType];
      clinicalEnity.records.forEach((rc, index) => {
        const donorId = rc[SampleRegistrationFieldsEnum.submitter_donor_id];
        filters.push({
          programId: command.programId,
          submitterId: donorId,
        });
        if (!clinicalSubmissionRecords[donorId]) {
          clinicalSubmissionRecords[donorId] = {};
        }
        // by this point we have already validated for uniqueness
        ClinicalSubmissionRecordsOperations.addRecord(
          clinicalType as ClinicalEntitySchemaNames,
          clinicalSubmissionRecords[donorId],
          {
            ...rc,
            submitter_donor_id: donorId,
            index: index,
          },
        );
      });
    }

    const relevantDonorsMap = await getDonorsInProgram(filters);
    const validateResult: ClinicalTypeValidateResult = await validateSubmissionData(
      clinicalSubmissionRecords,
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
    type: ClinicalEntitySchemaNames,
    result: SchemaProcessingResult,
    records: ReadonlyArray<DataRecord>,
  ) => {
    const errorsList = new Array<SubmissionValidationError>();
    result.validationErrors.forEach(schemaErr => {
      errorsList.push({
        index: schemaErr.index,
        type: schemaErr.errorType,
        info: getSchemaValidationErrorInfoObject(type, schemaErr, records[schemaErr.index]),
        fieldName: schemaErr.fieldName,
        message: schemaErr.message,
      });
    });
    return F(errorsList);
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
          [SampleRegistrationFieldsEnum.program_id]: command.programId,
          [SampleRegistrationFieldsEnum.submitter_donor_id]: r.donorSubmitterId,
          [SampleRegistrationFieldsEnum.gender]: r.gender,
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: r.specimenSubmitterId,
          [SampleRegistrationFieldsEnum.specimen_tissue_source]: r.specimenTissueSource,
          [SampleRegistrationFieldsEnum.tumour_normal_designation]: r.tumourNormalDesignation,
          [SampleRegistrationFieldsEnum.submitter_sample_id]: r.sampleSubmitterId,
          [SampleRegistrationFieldsEnum.sample_type]: r.sampleType,
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
          programId: r[SampleRegistrationFieldsEnum.program_id] as string,
          donorSubmitterId: r[SampleRegistrationFieldsEnum.submitter_donor_id] as string,
          gender: r[SampleRegistrationFieldsEnum.gender] as string,
          specimenSubmitterId: r[SampleRegistrationFieldsEnum.submitter_specimen_id] as string,
          specimenTissueSource: r[SampleRegistrationFieldsEnum.specimen_tissue_source] as string,
          tumourNormalDesignation: r[
            SampleRegistrationFieldsEnum.tumour_normal_designation
          ] as string,
          sampleSubmitterId: r[SampleRegistrationFieldsEnum.submitter_sample_id] as string,
          sampleType: r[SampleRegistrationFieldsEnum.sample_type] as string,
        };
        return rec;
      }),
    );
  }

  const checkClinicalEntity = async (
    command: ClinicalSubmissionCommand,
    schema: SchemasDictionary,
  ) => {
    // check records are unique
    const errors: SubmissionValidationError[] = checkUniqueRecords(
      command.clinicalType as ClinicalEntitySchemaNames,
      command.records,
    );

    let errorsAccumulator: DeepReadonly<SubmissionValidationError[]> = [];
    const validRecordsAccumulator: any[] = [];

    command.records.forEach((r, index) => {
      const schemaResult = schemaManager.instance().process(command.clinicalType, r, index, schema);

      if (schemaResult.validationErrors.length > 0) {
        errorsAccumulator = errorsAccumulator.concat(
          unifySchemaErrors(
            command.clinicalType as ClinicalEntitySchemaNames,
            schemaResult,
            command.records,
          ),
        );
      }

      const programIdError = usingInvalidProgramId(
        ClinicalEntitySchemaNames.REGISTRATION,
        index,
        r,
        command.programId,
      );
      errorsAccumulator = errorsAccumulator.concat(programIdError);
      validRecordsAccumulator.push(schemaResult.processedRecord);
    });

    return {
      schemaErrorsTemp: errors.concat(errorsAccumulator),
      processedRecords: validRecordsAccumulator,
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
    expectedClinicalEntites: ReadonlyArray<ClinicalEntitySchemaNames>,
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
          message: batchErrorMessage(SubmissionBatchErrorTypes.MULTIPLE_TYPED_FILES, {
            clinicalType,
          }),
          batchNames: dataMatchToType.map(data => data.batchName),
          code: SubmissionBatchErrorTypes.MULTIPLE_TYPED_FILES,
        });
      } else if (dataMatchToType.length == 1) {
        newClinicalEntitesMap[clinicalType] = dataMatchToType[0];
      }
    });

    if (mutableClinicalData.length > 0) {
      dataToEntityMapErrors.push({
        message: batchErrorMessage(SubmissionBatchErrorTypes.INVALID_FILE_NAME),
        batchNames: mutableClinicalData.map(data => data.batchName),
        code: SubmissionBatchErrorTypes.INVALID_FILE_NAME,
      });
    }

    return F({ newClinicalEntitesMap, dataToEntityMapErrors });
  };

  const checkEntityFieldNames = (newClinicalEntitesMap: DeepReadonly<NewClinicalEntities>) => {
    const fieldNameErrors: SubmissionBatchError[] = [];
    const filteredClinicalEntites: NewClinicalEntities = {};
    for (const [clinicalType, newClinicalEnity] of Object.entries(newClinicalEntitesMap)) {
      if (!newClinicalEnity.fieldNames) {
        filteredClinicalEntites[clinicalType] = { ...newClinicalEnity };
        continue;
      }
      const commonFieldNamesSet = new Set(newClinicalEnity.fieldNames);
      const clinicalFieldNamesByPriorityMap = schemaManager
        .instance()
        .getSchemaFieldNamesWithPriority(clinicalType);
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

      if (missingFields.length > 0) {
        fieldNameErrors.push({
          message: batchErrorMessage(SubmissionBatchErrorTypes.MISSING_REQUIRED_HEADER, {
            missingFields,
          }),
          batchNames: [newClinicalEnity.batchName],
          code: SubmissionBatchErrorTypes.MISSING_REQUIRED_HEADER,
        });
      }

      if (unknownFields.length > 0) {
        fieldNameErrors.push({
          message: batchErrorMessage(SubmissionBatchErrorTypes.UNRECOGNIZED_HEADER, {
            unknownFields,
          }),
          batchNames: [newClinicalEnity.batchName],
          code: SubmissionBatchErrorTypes.UNRECOGNIZED_HEADER,
        });
      }
    }
    return { filteredClinicalEntites, fieldNameErrors };
  };

  // pre check registration create command
  const preCheckRegistrationFields = (
    command: CreateRegistrationCommand,
  ): DeepReadonly<SubmissionBatchError[] | undefined> => {
    const {
      newClinicalEntitesMap: registrationMapped,
      dataToEntityMapErrors,
    } = mapClinicalDataToEntity(
      [
        {
          records: command.records,
          batchName: command.batchName,
          creator: command.creator,
          fieldNames: command.fieldNames,
        },
      ],
      [ClinicalEntitySchemaNames.REGISTRATION],
    );
    if (dataToEntityMapErrors.length !== 0) {
      return dataToEntityMapErrors;
    }
    const { fieldNameErrors } = checkEntityFieldNames(registrationMapped);
    if (fieldNameErrors.length !== 0) {
      return fieldNameErrors;
    }
    return undefined;
  };

  export function mergeIcgcLegacyData(clinicalData: any, programId: string) {
    const result: Donor[] = [];

    clinicalData.donors.forEach((d: any) => {
      validateRequiredColumns(d, ['icgc_donor_id', 'submitted_donor_id']);
      result.push({
        donorId: d.icgc_donor_id,
        gender: d.donor_sex == '' ? 'Other' : _.startCase(d.donor_sex),
        programId,
        specimens: getIcgcDonorSpecimens(clinicalData, d),
        submitterId: d.submitted_donor_id,
      } as any);
    });
    return result;
  }

  export async function adminAddDonors(donors: Donor[]) {
    const schemaMetadata: SchemaMetadata = {
      isValid: true,
      lastValidSchemaVersion: schemaManager.instance().getCurrent().version,
      originalSchemaVersion: schemaManager.instance().getCurrent().version,
    };

    donors.forEach((d: any) => {
      d.createdAt = `${new Date()}`;
      d.__v = 1;
      d.updatedAt = `${new Date()}`;
      d.createBy = 'dcc-admin';
      d.schemaMetadata = schemaMetadata;
    });

    return await donorDao.insertDonors(donors);
  }
}

function getIcgcDonorSpecimens(clinicalData: any, donor: any) {
  const sps: Specimen[] = [];
  clinicalData.specimens.forEach((s: any) => {
    validateRequiredColumns(s, [
      'icgc_donor_id',
      'icgc_specimen_id',
      'submitted_specimen_id',
      'specimen_type',
    ]);
    if (s.icgc_donor_id !== donor.icgc_donor_id) {
      return;
    }
    sps.push({
      specimenId: s.icgc_specimen_id,
      submitterId: s.submitted_specimen_id,
      tumourNormalDesignation: getMappedTumorNormalDesignation(s.specimen_type),
      samples: getIcgcSpecimenSamples(clinicalData, s, donor),
      specimenTissueSource: getMappedTissueSource(s.specimen_type),
    });
  });
  return sps;
}

function getMappedTumorNormalDesignation(specimenType: string): string {
  const mapping = ICGC_SPECIMEN_TYPE_MAP[specimenType];
  if (mapping) {
    return mapping.tumour_normal_designation;
  }
  throw new Error('found unknow specimen type: ' + specimenType);
}

function getMappedTissueSource(specimenType: string): string {
  const mapping = ICGC_SPECIMEN_TYPE_MAP[specimenType];
  if (mapping) {
    return mapping.tissue_source;
  }
  throw new Error('found unknow specimen type: ' + specimenType);
}

function getIcgcSpecimenSamples(clinicalData: any, speciemn: any, donor: any) {
  const sps: Sample[] = [];
  clinicalData.samples.forEach((s: any) => {
    validateRequiredColumns(s, ['icgc_donor_id', 'icgc_specimen_id', 'submitted_sample_id']);
    if (
      s.icgc_donor_id !== donor.icgc_donor_id ||
      s.icgc_specimen_id !== speciemn.icgc_specimen_id
    ) {
      return;
    }
    sps.push({
      sampleId: s.icgc_sample_id,
      submitterId: s.submitted_sample_id,
      sampleType: 'SAMPLE_TYPE_PLACEHOLDER', // ask about this
    });
  });
  return sps;
}

function validateRequiredColumns(obj: any, cols: string[]) {
  for (const c of cols) {
    if (isEmptyString(obj[c])) {
      throw new Error(`row ${obj} is missing field:${c}`);
    }
  }
}

function prepareForSchemaReProcessing(record: object) {
  // we copy to avoid frozen attributes
  const copy = _.cloneDeep(record);
  return toString(copy);
}

// this is bassically findOneAndUpdate but with new version everytime
async function updateSubmissionWithVersionOrDeleteEmpty(
  programId: string,
  version: string,
  updatingFields: DeepReadonly<ActiveClinicalSubmission>,
): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined> {
  if (_.has(updatingFields, 'clinicalEntities') && _.isEmpty(updatingFields.clinicalEntities)) {
    await submissionRepository.deleteByProgramIdAndVersion({ programId, version });
    return undefined;
  }

  return await submissionRepository.updateSubmissionFieldsWithVersion(
    programId,
    version,
    updatingFields,
  );
}

const getSchemaValidationErrorInfoObject = (
  type: ClinicalEntitySchemaNames,
  schemaErr: DeepReadonly<SchemaValidationError>,
  record: DeepReadonly<DataRecord>,
) => {
  switch (type) {
    case ClinicalEntitySchemaNames.REGISTRATION: {
      return F({
        ...schemaErr.info,
        value: record[schemaErr.fieldName],
        donorSubmitterId: record[SampleRegistrationFieldsEnum.submitter_donor_id],
        specimenSubmitterId: record[SampleRegistrationFieldsEnum.submitter_specimen_id],
        sampleSubmitterId: record[SampleRegistrationFieldsEnum.submitter_sample_id],
      });
    }
    default: {
      return F({
        ...schemaErr.info,
        value: record[schemaErr.fieldName],
        donorSubmitterId: record[SampleRegistrationFieldsEnum.submitter_donor_id],
      });
    }
  }
};

const ICGC_SPECIMEN_TYPE_MAP: {
  [k: string]: {
    tumour_normal_designation: string;
    tissue_source: string;
  };
} = {
  'Normal - solid tissue': {
    tumour_normal_designation: 'Normal',
    tissue_source: 'Solid tissue',
  },
  'Normal - blood derived': {
    tumour_normal_designation: 'Normal',
    tissue_source: 'Blood derived',
  },
  'Normal - bone marrow': {
    tumour_normal_designation: 'Normal',
    tissue_source: 'Bone marrow',
  },
  'Normal - tissue adjacent to primary': {
    tumour_normal_designation: 'Normal - tissue adjacent to primary tumour',
    tissue_source: 'Solid tissue',
  },
  'Normal - buccal cell': {
    tumour_normal_designation: 'Normal',
    tissue_source: 'Buccal cell',
  },
  'Normal - EBV immortalized': {
    tumour_normal_designation: 'Normal',
    tissue_source: 'Other',
  },
  'Normal - lymph node': {
    tumour_normal_designation: 'Normal',
    tissue_source: 'Lymph node',
  },
  'Normal - other': {
    tumour_normal_designation: 'Normal',
    tissue_source: 'Other',
  },
  'Primary tumour - solid tissue': {
    tumour_normal_designation: 'Primary tumour',
    tissue_source: 'Solid Tissue',
  },
  'Primary tumour - blood derived (peripheral blood)': {
    tumour_normal_designation: 'Primary tumour',
    tissue_source: 'Blood derived - peripheral blood',
  },
  'Primary tumour - blood derived (bone marrow)': {
    tumour_normal_designation: 'Primary tumour',
    tissue_source: 'Blood derived - bone marrow',
  },
  'Primary tumour - additional new primary': {
    tumour_normal_designation: 'Primary tumour',
    tissue_source: 'Other',
  },
  'Primary tumour - other': {
    tumour_normal_designation: 'Primary tumour',
    tissue_source: 'Other',
  },
  'Recurrent tumour - solid tissue': {
    tumour_normal_designation: 'Recurrent tumour',
    tissue_source: 'Solid tissue',
  },
  'Recurrent tumour - blood derived (peripheral blood)': {
    tumour_normal_designation: 'Recurrent tumour',
    tissue_source: 'Blood derived - peripheral blood',
  },
  'Recurrent tumour - blood derived (bone marrow)': {
    tumour_normal_designation: 'Recurrent tumour',
    tissue_source: 'Blood derived - bone marrow',
  },
  'Recurrent tumour - other': {
    tumour_normal_designation: 'Recurrent tumour',
    tissue_source: 'Other',
  },
  'Metastatic tumour - NOS': {
    tumour_normal_designation: 'Metastatic tumour',
    tissue_source: 'Other',
  },
  'Metastatic tumour - lymph node': {
    tumour_normal_designation: 'Metastatic tumour',
    tissue_source: 'Lymph node',
  },
  'Metastatic tumour - metastasis local to lymph node': {
    tumour_normal_designation: 'Metastatic tumour - metastasis local to lymph node',
    tissue_source: 'Lymph node',
  },
  'Metastatic tumour - metastasis to distant location': {
    tumour_normal_designation: 'Metastatic tumour - metastasis to distant location',
    tissue_source: 'Other',
  },
  'Metastatic tumour - additional metastatic': {
    tumour_normal_designation: 'Metastatic tumour - additional metastatic',
    tissue_source: 'Other',
  },
  'Xenograft - derived from primary tumour': {
    tumour_normal_designation: 'Xenograft - derived from primary tumour',
    tissue_source: 'Other',
  },
  'Xenograft - derived from tumour cell line': {
    tumour_normal_designation: 'Xenograft - derived from tumour cell line',
    tissue_source: 'Other',
  },
  'Cell line - derived from tumour': {
    tumour_normal_designation: 'Cell line - derived from tumour',
    tissue_source: 'Other',
  },
  'Primary tumour - lymph node': {
    tumour_normal_designation: 'Primary tumour',
    tissue_source: 'Lymph node',
  },
  'Metastatic tumour - other': {
    tumour_normal_designation: 'Metastatic tumour',
    tissue_source: 'Other',
  },
  'Cell line - derived from xenograft tumour': {
    tumour_normal_designation: 'Cell line - derived from xenograft tumour',
    tissue_source: 'Other',
  },
};
