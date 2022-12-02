/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import * as dataValidator from './validation-clinical/validation';
import {
  donorDao,
  FindByProgramAndSubmitterFilter,
  DONOR_DOCUMENT_FIELDS,
} from '../clinical/donor-repo';
import _ from 'lodash';
import { registrationRepository } from './registration-repo';
import {
  Donor,
  DonorMap,
  Specimen,
  Sample,
  SchemaMetadata,
  DonorBySubmitterIdMap,
  ClinicalEntity,
} from '../clinical/clinical-entities';
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
  BatchNameRegex,
  ClinicalSubmissionRecordsByDonorIdMap,
  RevalidateClinicalSubmissionCommand,
  LegacyICGCImportRecord,
  DataValidationErrors,
} from './submission-entities';
import * as dictionaryManager from '../dictionary/manager';
import * as messenger from './submission-updates-messenger';
import { loggerFor } from '../logger';
import { DonorUtils } from '../utils';
import {
  Errors,
  F,
  isStringMatchRegex,
  toString,
  isEmptyString,
  isNotAbsent,
  notEmpty,
} from '../utils';
import { DeepReadonly } from 'deep-freeze';
import { submissionRepository } from './submission-repo';
import { v1 as uuid } from 'uuid';
import dbRxNormService from '../rxnorm/service';
import { RxNormConcept } from '../rxnorm/api';
import { validateSubmissionData, checkUniqueRecords } from './validation-clinical/validation';
import { batchErrorMessage, validationErrorMessage } from './submission-error-messages';
import {
  ClinicalSubmissionRecordsOperations,
  usingInvalidProgramId,
} from './validation-clinical/utils';
import {
  ClinicalEntitySchemaNames,
  DonorFieldsEnum,
  TherapyRxNormFields,
} from '../common-model/entities';

import { entities as dictionaryEntities } from '@overturebio-stack/lectern-client';
import { programExceptionRepository } from '../exception/exception-repo';
import { ProgramException } from '../exception/types';
import { DataRecord } from '@overturebio-stack/lectern-client/lib/schema-entities';

const L = loggerFor(__filename);

const emptySubmission = {
  dataErrors: [],
  dataUpdates: [],
  dataWarnings: [],
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

    const currentDictionary = await dictionaryManager.instance().getCurrent();

    const preCheckError = await preCheckRegistrationFields(command, currentDictionary);
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

    let start = new Date().getTime() / 1000;
    // a loop that async loops through all records
    await Promise.all(
      command.records.map(async (r, index) => {
        const schemaResult = await dictionaryManager
          .instance()
          .processParallel(ClinicalEntitySchemaNames.REGISTRATION, r, index, currentDictionary);

        if (anyErrors(schemaResult.validationErrors)) {
          unifiedSchemaErrors = unifiedSchemaErrors.concat(
            unifySchemaErrors(
              ClinicalEntitySchemaNames.REGISTRATION,
              schemaResult.validationErrors,
              index,
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

        unifiedSchemaErrors = unifiedSchemaErrors.concat(programIdError);
        // we have to insert at correct index since records may be accumulated out of order
        validRecordsAccumulator[index] = schemaResult.processedRecord;

        return undefined;
      }),
    );
    let end = new Date().getTime() / 1000;
    L.info(`schema validation took ${end - start} s`);

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

    // all donors in a program, and build memory indexes for fast lookups by donor, specimen, sample submitter Ids
    const allDonors = await donorDao.findByProgramId(command.programId, {
      [DONOR_DOCUMENT_FIELDS.DONOR_ID]: 1,
      [DONOR_DOCUMENT_FIELDS.PROGRAM_ID]: 1,
      [DONOR_DOCUMENT_FIELDS.SUBMITTER_ID]: 1,
      [DONOR_DOCUMENT_FIELDS.GENDER]: 1,
      [DONOR_DOCUMENT_FIELDS.SPECIMEN_SUBMITTER_ID]: 1,
      [DONOR_DOCUMENT_FIELDS.SPECIMEN_TISSUE_SOURCE]: 1,
      [DONOR_DOCUMENT_FIELDS.SPECIMEN_TYPE]: 1,
      [DONOR_DOCUMENT_FIELDS.SPECIMEN_TUMOR_NORMAL_DESIGNATION]: 1,
      [DONOR_DOCUMENT_FIELDS.SAMPLE_TYPE]: 1,
      [DONOR_DOCUMENT_FIELDS.SPECIMEN_SAMPLE_SUBMITTER_ID]: 1,
    });

    const allDonorsMap: DonorBySubmitterIdMap = {};
    const allDonorsBySpecimenIdMap: DonorBySubmitterIdMap = {};
    const allDonorsBySampleIdMap: DonorBySubmitterIdMap = {};

    allDonors.forEach(d => {
      allDonorsMap[d.submitterId] = d;
      d.specimens.forEach(sp => {
        allDonorsBySpecimenIdMap[sp.submitterId] = d;
        sp.samples.forEach(sa => {
          allDonorsBySampleIdMap[sa.submitterId] = d;
        });
      });
    });

    start = new Date().getTime() / 1000;
    const { errors } = await dataValidator.validateRegistrationData(
      registrationRecords,
      allDonorsBySpecimenIdMap,
      allDonorsBySampleIdMap,
      allDonorsMap,
    );
    end = new Date().getTime() / 1000;
    L.info(`registration data validation took ${end - start} s`);

    if (errors.length > 0) {
      L.info(`found ${errors.length} data errors in registration attempt`);
      return F({
        registration: undefined,
        stats: undefined,
        errors: errors,
        successful: false,
      });
    }

    const stats = calculateUpdates(registrationRecords, allDonorsMap);

    // save the new registration object
    const schemaVersion = currentDictionary.version;
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
            ...emptySubmission,
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

    const currentDictionary = await dictionaryManager.instance().getCurrent();

    // Step 1 map dataArray to entitesMap
    const { newClinicalEntitesMap, dataToEntityMapErrors } = mapClinicalDataToEntity(
      command.newClinicalData,
      Object.values(ClinicalEntitySchemaNames).filter(
        type => type !== ClinicalEntitySchemaNames.REGISTRATION,
      ),
    );

    // Step 2 filter entites with invalid fieldNames
    const { filteredClinicalEntites, fieldNameErrors } = await checkEntityFieldNames(
      newClinicalEntitesMap,
      currentDictionary,
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
        currentDictionary,
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
        ...emptySubmission,
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
    targetSchema: dictionaryEntities.SchemasDictionary,
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

      const warnings = validateResult[clinicalType].dataWarnings;
      validatedClinicalEntities[clinicalType].dataWarnings = warnings;

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
        ...emptySubmission,
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
    validationErrors: dictionaryEntities.SchemaProcessingResult['validationErrors'],
    index: number,
    records: ReadonlyArray<dictionaryEntities.DataRecord>,
  ) => {
    const errorsList = new Array<SubmissionValidationError>();
    validationErrors.forEach(schemaErr => {
      errorsList.push({
        index: index,
        type: schemaErr.errorType,
        info: getValidationErrorInfoObject(type, schemaErr, records[schemaErr.index]),
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
      addRowNumberToStats(stats.alreadyRegistered, nd.sampleSubmitterId, index);
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
          [SampleRegistrationFieldsEnum.specimen_type]: r.specimenType,
          [SampleRegistrationFieldsEnum.submitter_sample_id]: r.sampleSubmitterId,
          [SampleRegistrationFieldsEnum.sample_type]: r.sampleType,
        };
        return record;
      }),
    });
  };

  const anyErrors = (schemaErrors: DeepReadonly<dictionaryEntities.SchemaValidationError[]>) => {
    return schemaErrors.length > 0 || schemaErrors.length > 0;
  };

  function mapToRegistrationRecord(records: DeepReadonly<dictionaryEntities.TypedDataRecord[]>) {
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
          specimenType: r[SampleRegistrationFieldsEnum.specimen_type] as string,
          sampleSubmitterId: r[SampleRegistrationFieldsEnum.submitter_sample_id] as string,
          sampleType: r[SampleRegistrationFieldsEnum.sample_type] as string,
        };
        return rec;
      }),
    );
  }

  const applyExceptionIfExists = (
    exceptions: DeepReadonly<ProgramException['exceptions']>,
    validationError: dictionaryEntities.SchemaValidationError,
    record: DataRecord,
  ): boolean => {
    // missing required field, validate as normal, exceptions still require a submitted value
    if (
      validationError.errorType ===
      dictionaryEntities.SchemaValidationErrorTypes.MISSING_REQUIRED_FIELD
    ) {
      return false;
    }
    // every other validation of SchemaValidationErrorTypes check for exception
    else {
      const validationErrorField = validationError.fieldName;
      const exception = exceptions.find(exception => exception.coreField === validationErrorField);
      return !exception ? false : exception.exceptionValue === record[validationErrorField];
    }
  };

  const checkClinicalEntity = async (
    command: ClinicalSubmissionCommand,
    schema: dictionaryEntities.SchemasDictionary,
  ) => {
    const schemaName = command.clinicalType as ClinicalEntitySchemaNames;

    // check records are unique
    const errors: SubmissionValidationError[] = checkUniqueRecords(schemaName, command.records);

    let errorsAccumulator: DeepReadonly<SubmissionValidationError[]> = [];
    const validRecordsAccumulator: any[] = [];

    await Promise.all(
      command.records.map(async (record, index) => {
        let processedRecord: any = {};
        const schemaResult = await dictionaryManager
          .instance()
          .processParallel(command.clinicalType, record, index, schema);

        if (schemaResult.validationErrors.length > 0) {
          const programException = await programExceptionRepository.find(command.programId);

          // filter out valid exceptions before adding to error accumulator
          const validationErrors =
            // only filter is we have valid exceptions available
            programException && programException?.exceptions.length > 0
              ? schemaResult.validationErrors.filter(validationError => {
                  return !applyExceptionIfExists(
                    programException.exceptions,
                    validationError,
                    record,
                  );
                })
              : schemaResult.validationErrors;

          errorsAccumulator = errorsAccumulator.concat(
            unifySchemaErrors(schemaName, validationErrors, index, command.records),
          );
        }

        processedRecord = schemaResult.processedRecord;
        const programIdError = usingInvalidProgramId(
          ClinicalEntitySchemaNames.REGISTRATION,
          index,
          record,
          command.programId,
        );
        errorsAccumulator = errorsAccumulator.concat(programIdError);

        // special case for therapies where we need to populate the rxnorm Ids, only do this step
        // if the record is valid so far to avoid spending alot of time here
        if (errorsAccumulator.length == 0 && isRxNormTherapy(command.clinicalType)) {
          const result = await validateRxNormFields(processedRecord, index, schemaName);
          if (result.error != undefined) {
            errorsAccumulator = errorsAccumulator.concat([result.error]);
          }
          if (result.record != undefined) {
            processedRecord = result.record;
          }
        }

        // respect the original order of the records
        validRecordsAccumulator[index] = processedRecord;
      }),
    );

    return {
      schemaErrorsTemp: errors.concat(errorsAccumulator),
      processedRecords: validRecordsAccumulator,
    };
  };

  function isRxNormTherapy(entity: string) {
    return (
      entity == ClinicalEntitySchemaNames.CHEMOTHERAPY ||
      entity == ClinicalEntitySchemaNames.HORMONE_THERAPY ||
      entity == ClinicalEntitySchemaNames.IMMUNOTHERAPY
    );
  }

  async function validateRxNormFields(
    r: dictionaryEntities.TypedDataRecord,
    index: number,
    therapyType: ClinicalEntitySchemaNames,
  ): Promise<{
    record: dictionaryEntities.TypedDataRecord | undefined;
    error: SubmissionValidationError | undefined;
  }> {
    const rxnormConceptLookupResult = await lookupRxNormConcept(r, index);
    if (rxnormConceptLookupResult.error != undefined) {
      rxnormConceptLookupResult.error.info = getValidationErrorInfoObject(
        therapyType,
        rxnormConceptLookupResult.error,
        r,
      );
      return { error: rxnormConceptLookupResult.error, record: undefined };
    }
    if (rxnormConceptLookupResult.rxNormRecord == undefined) {
      throw new Error("shouldn't happen");
    }
    const recordWithRxNormPopulated = _.cloneDeep(r) as Record<string, any>;
    // we replace the drug name to normalize the case
    recordWithRxNormPopulated[TherapyRxNormFields.drug_name] =
      rxnormConceptLookupResult.rxNormRecord.str;
    recordWithRxNormPopulated[TherapyRxNormFields.drug_rxnormid] =
      rxnormConceptLookupResult.rxNormRecord.rxcui;
    return {
      record: recordWithRxNormPopulated as dictionaryEntities.TypedDataRecord,
      error: undefined,
    };
  }

  async function lookupRxNormConcept(
    therapyRecord: dictionaryEntities.TypedDataRecord,
    index: number,
  ): Promise<{
    rxNormRecord: RxNormConcept | undefined;
    error: SubmissionValidationError | undefined;
  }> {
    // if the id is provided we do a look up and double check against the name (if provided)
    if (isNotAbsent(therapyRecord[TherapyRxNormFields.drug_rxnormid] as string)) {
      const rxcui = therapyRecord[TherapyRxNormFields.drug_rxnormid] as string;
      const rxRecords = await dbRxNormService.lookupByRxcui(rxcui.trim());
      if (_.isEmpty(rxRecords)) {
        const error: SubmissionValidationError = {
          fieldName: TherapyRxNormFields.drug_rxnormid,
          index: index,
          info: {},
          message: validationErrorMessage(DataValidationErrors.THERAPY_RXNORM_RXCUI_NOT_FOUND),
          type: DataValidationErrors.THERAPY_RXNORM_RXCUI_NOT_FOUND,
        };
        return {
          rxNormRecord: undefined,
          error: error,
        };
      }

      const matchingRecord = rxRecords.find(
        rx =>
          rx.str.toLowerCase().trim() ==
          (therapyRecord[TherapyRxNormFields.drug_name] as string).toLowerCase().trim(),
      );

      if (matchingRecord != undefined) {
        return {
          rxNormRecord: matchingRecord,
          error: undefined,
        };
      }

      const foundNames = rxRecords.map(r => r.str);
      const error: SubmissionValidationError = {
        fieldName: TherapyRxNormFields.drug_rxnormid,
        index: index,
        info: {},
        message: validationErrorMessage(DataValidationErrors.THERAPY_RXNORM_DRUG_NAME_INVALID, {
          foundNames,
        }),
        type: DataValidationErrors.THERAPY_RXNORM_DRUG_NAME_INVALID,
      };
      return {
        rxNormRecord: undefined,
        error: error,
      };
    }

    // nothing was provided
    // this shouldn't happen unless the schema is not validating correctly
    const error: SubmissionValidationError = {
      fieldName: TherapyRxNormFields.drug_rxnormid,
      index: index,
      info: {},
      message: `an rxcui id or drug name is required`,
      type: DataValidationErrors.THERAPY_MISSING_RXNORM_FIELDS,
    };
    return {
      rxNormRecord: undefined,
      error: error,
    };
  }

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

    const wrongUploadSection = _.remove(mutableClinicalData, clinicalData =>
      isStringMatchRegex(
        BatchNameRegex[ClinicalEntitySchemaNames.REGISTRATION],
        clinicalData.batchName,
      ),
    );

    // Check to see if a sample registration file was mistakenly uploaded in this section
    if (wrongUploadSection.length) {
      dataToEntityMapErrors.push({
        message: batchErrorMessage(SubmissionBatchErrorTypes.INCORRECT_SECTION),
        batchNames: wrongUploadSection.map(data => data.batchName),
        code: SubmissionBatchErrorTypes.INCORRECT_SECTION,
      });
    }

    if (mutableClinicalData.length > 0) {
      dataToEntityMapErrors.push({
        message: batchErrorMessage(SubmissionBatchErrorTypes.INVALID_FILE_NAME, {
          isRegistration: expectedClinicalEntites.includes(ClinicalEntitySchemaNames.REGISTRATION),
        }),
        batchNames: mutableClinicalData.map(data => data.batchName),
        code: SubmissionBatchErrorTypes.INVALID_FILE_NAME,
      });
    }

    return F({ newClinicalEntitesMap, dataToEntityMapErrors });
  };

  const checkEntityFieldNames = async (
    newClinicalEntitesMap: DeepReadonly<NewClinicalEntities>,
    dictionary: dictionaryEntities.SchemasDictionary,
  ) => {
    const fieldNameErrors: SubmissionBatchError[] = [];
    const filteredClinicalEntites: NewClinicalEntities = {};

    for (const [clinicalType, newClinicalEnity] of Object.entries(newClinicalEntitesMap)) {
      if (!newClinicalEnity.fieldNames) {
        filteredClinicalEntites[clinicalType] = { ...(newClinicalEnity as NewClinicalEntity) };
        continue;
      }
      const commonFieldNamesSet = new Set(newClinicalEnity.fieldNames);
      const clinicalFieldNamesByPriorityMap = await dictionaryManager
        .instance()
        .getSchemaFieldNamesWithPriority(clinicalType, dictionary);
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
        filteredClinicalEntites[clinicalType] = { ...(newClinicalEnity as NewClinicalEntity) };
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
  const preCheckRegistrationFields = async (
    command: CreateRegistrationCommand,
    dictionary: dictionaryEntities.SchemasDictionary,
  ): Promise<DeepReadonly<SubmissionBatchError[] | undefined>> => {
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
    const { fieldNameErrors } = await checkEntityFieldNames(registrationMapped, dictionary);
    if (fieldNameErrors.length !== 0) {
      return fieldNameErrors;
    }
    return undefined;
  };

  export function mergeIcgcLegacyData(
    legacySamples: Readonly<LegacyICGCImportRecord>[],
    programId: string,
  ) {
    const result: Donor[] = [];
    // since rows can have duplicated donor ids we don't need to reprocess.
    const processedDonorIds = new Set<string>();
    legacySamples.forEach((donorRow: LegacyICGCImportRecord, i: number) => {
      validateRequiredColumns(i, donorRow, ['icgc_donor_id', 'submitted_donor_id', 'donor_sex']);
      // we already processed the donor and their samples, specimens
      if (processedDonorIds.has(donorRow.icgc_donor_id)) {
        return;
      }
      processedDonorIds.add(donorRow.icgc_donor_id);
      result.push({
        donorId: parseInt(donorRow.icgc_donor_id.substring(2), 10),
        gender:
          donorRow.donor_sex == '' || donorRow.donor_sex == 'unspecified'
            ? OTHER
            : _.startCase(donorRow.donor_sex),
        programId: programId.toUpperCase(),
        specimens: getIcgcDonorSpecimens(legacySamples, donorRow),
        submitterId: donorRow.submitted_donor_id,
      } as any);
    });
    return result;
  }

  /* importLegacyDonors
   *   Used for importing donor/specimen/sample data from ICGC.
   *   Primary intent is to add entities with original ICGC Ids (not generated IDs by clinical)
   *   Ideally, this is run once per program. Situations have come up where new ICGC data needs to be added
   *    to a program that was already imported, so this is able to process existing donors by adding new
   *    samples/specimens to a donor that already exists without modifying the existing donor/sample/specimen.
   */
  export async function importLegacyDonors(donors: Donor[]) {
    const actionPromises = []; // ensure all mongo actions complete before return by tracking them here.

    const currentDictionaryVersion = await dictionaryManager.instance().getCurrentVersion();
    const schemaMetadata: SchemaMetadata = {
      isValid: true,
      lastValidSchemaVersion: currentDictionaryVersion,
      originalSchemaVersion: currentDictionaryVersion,
    };

    const programsIncluded = _.uniq(donors.map(donor => donor.programId));

    // Check if existing donor or new:
    const dbReads = programsIncluded.map(programId => donorDao.findByProgramId(programId));
    const dbDonors = _.flatten(await Promise.all(dbReads));
    const dbDonorIds = dbDonors.map(donor => donor.donorId);

    const newDonors = donors.filter(donor => !dbDonorIds.includes(donor.donorId));

    newDonors.forEach((d: any) => {
      d.createdAt = new Date();
      d.__v = 1;
      d.updatedAt = new Date();
      d.createdBy = 'dcc-admin';
      d.schemaMetadata = schemaMetadata;
    });

    if (!_.isEmpty(newDonors)) {
      actionPromises.push(donorDao.insertDonors(newDonors));
    }

    const existingDonors = donors.filter(donor => dbDonorIds.includes(donor.donorId));

    existingDonors.forEach(donor => {
      // The donor is already in the DB, so we need to loop through its Specimens and Samples to find any new ones to add.

      const dbDonor = dbDonors.find(i => i.donorId === donor.donorId);
      if (dbDonor) {
        // Will be found because of above filter, do this check to keep TS happy

        const updatedDonor = _.cloneDeep(dbDonor) as Donor;
        let updated = false;

        donor.specimens.forEach(specimen => {
          const existingSpecimen = updatedDonor.specimens.find(
            s => s.specimenId === specimen.specimenId,
          );

          if (existingSpecimen) {
            // Found existing specimen, check samples for it
            specimen.samples.forEach(sample => {
              const existingSample = existingSpecimen.samples.find(
                s => s.sampleId === sample.sampleId,
              );
              if (!existingSample) {
                // found a new sample, need to add to donor
                existingSpecimen.samples.push(sample);
                updated = true;
              }
            });
          } else {
            updatedDonor.specimens.push(specimen);
            updated = true;
          }
        });

        if (updated) {
          updatedDonor.updatedAt = new Date().toDateString();
          delete updatedDonor._id;
          actionPromises.push(donorDao.updateDonor(updatedDonor));
        }
      }
    });

    await Promise.all(actionPromises); // let all mongo actions finish, will catch errors.
    return {
      newDonors: newDonors.length,
      updates: actionPromises.length - (newDonors.length ? 1 : 0), // weird math to not double count the insert(newDonors) action
    };
  }

  export async function adminDeleteSamples(
    programId: string,
    samplesSubmitterIds: string[],
    dryRun = true,
  ) {
    // validate the program has no active submissions
    const existingRegistration = await findByProgramId(programId);
    if (existingRegistration) {
      throw new Error(
        'Program has active registration in progress, cancel it or commit it to avoid conflicts.',
      );
    }

    const existingClinicalSubmission = await findSubmissionByProgramId(programId);
    if (existingClinicalSubmission) {
      throw new Error(
        'Program has active clinical data submission, you cannot delete specific samples if program has clinical data.',
      );
    }

    const promises = samplesSubmitterIds.map(ssi => {
      return donorDao.findBySampleSubmitterIdAndProgramId({
        programId: programId,
        submitterId: ssi,
      });
    });

    // wait on the queries to execute
    const donors = (await Promise.all(promises)).filter(notEmpty);
    if (donors.length == 0) {
      return {
        dryRun,
        samplesDeleted: [],
        specimensDeleted: [],
        donorsDeleted: [],
      };
    }
    // reject request if donors have clinical data
    const donorsWithClinicalData = donors
      .filter(notEmpty)
      .filter(d1 => !_.isEmpty(d1.clinicalInfo));
    if (donorsWithClinicalData.length > 0) {
      throw new Error(`Donors: ${donors.map(d => d?.submitterId)} have clinical data already`);
    }

    // filter donors in case multiple samples belong to same donor
    const filteredDonors = _.uniqBy(donors.filter(notEmpty), d => d.donorId);

    // remove specified samples
    const modifiableDonors = _.cloneDeep(filteredDonors) as Donor[];
    const result: any = {
      dryRun,
      samplesDeleted: [],
      specimensDeleted: [],
      donorsDeleted: [],
    };

    modifiableDonors.forEach(d => {
      d?.specimens.forEach(sp => {
        // filter out samples that ids are in the provided ids list to remove
        result.samplesDeleted = result.samplesDeleted.concat(
          sp.samples
            .filter(sa => samplesSubmitterIds.includes(sa.submitterId))
            .map(s => s.submitterId),
        );
        sp.samples = sp.samples.filter(sa => !samplesSubmitterIds.includes(sa.submitterId));
      });

      // if specimen has no samples, remove it
      result.specimensDeleted = result.specimensDeleted.concat(
        d.specimens.filter(sp => sp.samples.length == 0).map(s => s.submitterId),
      );
      d.specimens = d.specimens.filter(sp => sp.samples.length !== 0);
    });

    // update donors to save changes
    if (dryRun === false) {
      await donorDao.updateAll(modifiableDonors);
    }

    // delete donors with no specimens (tbd)
    const donorsWithNoSpecimens = modifiableDonors.filter(d => d.specimens.length == 0);
    result.donorsDeleted = result.donorsDeleted.concat(
      donorsWithNoSpecimens.map(d => d.submitterId),
    );
    if (dryRun === false) {
      donorDao.deleteByProgramIdAndDonorIds(
        programId,
        donorsWithNoSpecimens
          .map(d => d.donorId)
          .filter(id => Number(id) > 0)
          .filter(notEmpty),
      );
    }

    // if samples will be deleted, notify program update
    if (dryRun === false && result.samplesDeleted.length > 0) {
      await messenger.getInstance().sendProgramUpdatedMessage({
        programId,
        donorIds: modifiableDonors
          .filter(donor => donor.donorId)
          .map(donor => DonorUtils.prefixDonorId(donor.donorId as number)),
      });
    }
    return result;
  }
}

function getIcgcDonorSpecimens(
  legacySamples: Readonly<LegacyICGCImportRecord>[],
  donorRow: LegacyICGCImportRecord,
) {
  const sps: Specimen[] = [];
  // per donor we only need to process a specific specimen once to get all its samples.
  const processedDonorSpecimens = new Set<string>();
  legacySamples.forEach((specimenRow: LegacyICGCImportRecord, i: number) => {
    validateRequiredColumns(i, specimenRow, [
      'icgc_donor_id',
      'icgc_specimen_id',
      'submitted_specimen_id',
      'specimen_type',
    ]);

    if (specimenRow.icgc_donor_id !== donorRow.icgc_donor_id) {
      return;
    }
    if (processedDonorSpecimens.has(specimenRow.icgc_specimen_id)) {
      return;
    }

    processedDonorSpecimens.add(specimenRow.icgc_specimen_id);
    sps.push({
      specimenId: parseInt(specimenRow.icgc_specimen_id.substring(2), 10),
      submitterId: specimenRow.submitted_specimen_id,
      clinicalInfo: {},
      tumourNormalDesignation: getMappedTumorNormalDesignation(specimenRow.specimen_type),
      specimenType: getMappedSpecimenType(specimenRow.specimen_type),
      samples: getIcgcSpecimenSamples(legacySamples, specimenRow, donorRow),
      specimenTissueSource: getMappedTissueSource(specimenRow.specimen_type),
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

function getMappedSpecimenType(icgcSpecimenType: string): string {
  const mapping = ICGC_SPECIMEN_TYPE_MAP[icgcSpecimenType];
  if (mapping) {
    return mapping.specimen_type;
  }
  throw new Error('found unknow specimen type: ' + icgcSpecimenType);
}

function getMappedTissueSource(specimenType: string): string {
  const mapping = ICGC_SPECIMEN_TYPE_MAP[specimenType];
  if (mapping) {
    return mapping.tissue_source;
  }
  throw new Error('found unknow specimen type: ' + specimenType);
}

function getIcgcSpecimenSamples(
  legacySamples: LegacyICGCImportRecord[],
  speciemn: LegacyICGCImportRecord,
  donor: LegacyICGCImportRecord,
) {
  const sps: Sample[] = [];
  const processedSamplesForSpeciemn = new Set<string>();
  legacySamples.forEach((sampleRow: LegacyICGCImportRecord, i: number) => {
    validateRequiredColumns(i, sampleRow, [
      'icgc_donor_id',
      'icgc_specimen_id',
      'submitted_sample_id',
    ]);
    if (
      sampleRow.icgc_donor_id !== donor.icgc_donor_id ||
      sampleRow.icgc_specimen_id !== speciemn.icgc_specimen_id
    ) {
      return;
    }

    // we don't expect files to have same sample id twice
    if (processedSamplesForSpeciemn.has(sampleRow.icgc_sample_id)) {
      throw new Error('Duplicated sample');
    }

    processedSamplesForSpeciemn.add(sampleRow.icgc_sample_id);
    sps.push({
      sampleId: parseInt(sampleRow.icgc_sample_id.substring(2), 10),
      submitterId: sampleRow.submitted_sample_id,
      sampleType: getSampleTypeFromLegacySample(sampleRow),
    });
  });
  return sps;
}

function getSampleTypeFromLegacySample(sample: any): string {
  const ls: string = sample.library_strategy;
  if (ls.indexOf('WGS') >= 0 || ls.indexOf('WXS') >= 0) {
    return 'Total DNA';
  }

  if (ls == 'RNA-Seq') {
    return 'Total RNA';
  }

  if (ls == 'miRNA-Seq') {
    return 'Other RNA fractions';
  }

  L.error(`invalid sample type in this row ${JSON.stringify(sample)}`, undefined);
  throw new Error('invalid sample type');
}

function validateRequiredColumns(index: number, obj: any, cols: string[]) {
  for (const c of cols) {
    if (isEmptyString(obj[c])) {
      throw new Error(`row ${JSON.stringify(obj)} is missing field:${c}`);
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

const getValidationErrorInfoObject = (
  type: ClinicalEntitySchemaNames,
  err: DeepReadonly<dictionaryEntities.SchemaValidationError | SubmissionValidationError>,
  record: DeepReadonly<dictionaryEntities.DataRecord | dictionaryEntities.TypedDataRecord>,
) => {
  switch (type) {
    case ClinicalEntitySchemaNames.REGISTRATION: {
      return F({
        ...err.info,
        value: err.info.value || record[err.fieldName], // use record value if error value is not specifed
        donorSubmitterId: record[SampleRegistrationFieldsEnum.submitter_donor_id],
        specimenSubmitterId: record[SampleRegistrationFieldsEnum.submitter_specimen_id],
        sampleSubmitterId: record[SampleRegistrationFieldsEnum.submitter_sample_id],
      });
    }
    default: {
      return F({
        ...err.info,
        value: err.info.value || record[err.fieldName], // use record value if error value is not specifed
        donorSubmitterId: record[DonorFieldsEnum.submitter_donor_id],
      });
    }
  }
};

const SOLID_TISSUE = 'Solid tissue';
const OTHER = 'Other';
const NORMAL = 'Normal';
const TUMOR = 'Tumour';
const PRIMARY_TUMOR = 'Primary tumour';
const RECURRENT_TUMOR = 'Recurrent tumour';
const METASTATIC_TUMOR = 'Metastatic tumour';
const LYMPH_NODE = 'Lymph node';

const ICGC_SPECIMEN_TYPE_MAP: {
  [k: string]: {
    tumour_normal_designation: string;
    specimen_type: string;
    tissue_source: string;
  };
} = {
  'Normal - solid tissue': {
    tumour_normal_designation: NORMAL,
    specimen_type: NORMAL,
    tissue_source: SOLID_TISSUE,
  },
  'Normal - blood derived': {
    tumour_normal_designation: NORMAL,
    specimen_type: NORMAL,
    tissue_source: 'Blood derived',
  },
  'Normal - bone marrow': {
    tumour_normal_designation: NORMAL,
    specimen_type: NORMAL,
    tissue_source: 'Bone marrow',
  },
  'Normal - tissue adjacent to primary': {
    tumour_normal_designation: NORMAL, // might need to double check
    specimen_type: 'Normal - tissue adjacent to primary tumour',
    tissue_source: SOLID_TISSUE,
  },
  'Normal - buccal cell': {
    tumour_normal_designation: NORMAL,
    specimen_type: NORMAL,
    tissue_source: 'Buccal cell',
  },
  'Normal - EBV immortalized': {
    tumour_normal_designation: NORMAL,
    specimen_type: NORMAL,
    tissue_source: OTHER,
  },
  'Normal - lymph node': {
    tumour_normal_designation: NORMAL,
    specimen_type: NORMAL,
    tissue_source: LYMPH_NODE,
  },
  'Normal - other': {
    tumour_normal_designation: NORMAL,
    specimen_type: NORMAL,
    tissue_source: OTHER,
  },
  'Primary tumour - solid tissue': {
    tumour_normal_designation: TUMOR,
    specimen_type: PRIMARY_TUMOR,
    tissue_source: SOLID_TISSUE,
  },
  'Primary tumour - blood derived (peripheral blood)': {
    tumour_normal_designation: TUMOR,
    specimen_type: PRIMARY_TUMOR,
    tissue_source: 'Blood derived - peripheral blood',
  },
  'Primary tumour - blood derived (bone marrow)': {
    tumour_normal_designation: TUMOR,
    specimen_type: PRIMARY_TUMOR,
    tissue_source: 'Blood derived - bone marrow',
  },
  'Primary tumour - additional new primary': {
    tumour_normal_designation: TUMOR,
    specimen_type: PRIMARY_TUMOR,
    tissue_source: OTHER,
  },
  'Primary tumour - other': {
    tumour_normal_designation: TUMOR,
    specimen_type: PRIMARY_TUMOR,
    tissue_source: OTHER,
  },
  'Recurrent tumour - solid tissue': {
    tumour_normal_designation: TUMOR,
    specimen_type: RECURRENT_TUMOR,
    tissue_source: SOLID_TISSUE,
  },
  'Recurrent tumour - blood derived (peripheral blood)': {
    tumour_normal_designation: TUMOR,
    specimen_type: RECURRENT_TUMOR,
    tissue_source: 'Blood derived - peripheral blood',
  },
  'Recurrent tumour - blood derived (bone marrow)': {
    tumour_normal_designation: TUMOR,
    specimen_type: RECURRENT_TUMOR,
    tissue_source: 'Blood derived - bone marrow',
  },
  'Recurrent tumour - other': {
    tumour_normal_designation: TUMOR,
    specimen_type: RECURRENT_TUMOR,
    tissue_source: OTHER,
  },
  'Metastatic tumour - NOS': {
    tumour_normal_designation: TUMOR,
    specimen_type: METASTATIC_TUMOR,
    tissue_source: OTHER,
  },
  'Metastatic tumour - lymph node': {
    tumour_normal_designation: TUMOR,
    specimen_type: METASTATIC_TUMOR,
    tissue_source: LYMPH_NODE,
  },
  'Metastatic tumour - metastasis local to lymph node': {
    tumour_normal_designation: TUMOR,
    specimen_type: 'Metastatic tumour - metastasis local to lymph node',
    tissue_source: LYMPH_NODE,
  },
  'Metastatic tumour - metastasis to distant location': {
    tumour_normal_designation: TUMOR,
    specimen_type: 'Metastatic tumour - metastasis to distant location',
    tissue_source: OTHER,
  },
  'Metastatic tumour - additional metastatic': {
    tumour_normal_designation: TUMOR,
    specimen_type: 'Metastatic tumour - additional metastatic',
    tissue_source: OTHER,
  },
  'Xenograft - derived from primary tumour': {
    tumour_normal_designation: TUMOR,
    specimen_type: 'Xenograft - derived from primary tumour',
    tissue_source: OTHER,
  },
  'Xenograft - derived from tumour cell line': {
    tumour_normal_designation: TUMOR,
    specimen_type: 'Xenograft - derived from tumour cell line',
    tissue_source: OTHER,
  },
  'Cell line - derived from tumour': {
    tumour_normal_designation: TUMOR,
    specimen_type: 'Cell line - derived from tumour',
    tissue_source: OTHER,
  },
  'Primary tumour - lymph node': {
    tumour_normal_designation: TUMOR,
    specimen_type: PRIMARY_TUMOR,
    tissue_source: LYMPH_NODE,
  },
  'Metastatic tumour - other': {
    tumour_normal_designation: TUMOR,
    specimen_type: METASTATIC_TUMOR,
    tissue_source: OTHER,
  },
  'Cell line - derived from xenograft tumour': {
    tumour_normal_designation: TUMOR,
    specimen_type: 'Cell line - derived from xenograft tumour',
    tissue_source: OTHER,
  },
};
