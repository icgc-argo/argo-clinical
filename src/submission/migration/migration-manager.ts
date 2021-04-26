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

import {
  functions as dictionaryService,
  entities as dictionaryEntities,
} from '@overturebio-stack/lectern-client';
import { loggerFor } from '../../logger';
import { migrationRepo } from './migration-repo';
import {
  DictionaryMigration,
  NewSchemaVerificationResult,
  DonorMigrationSchemaErrors,
} from './migration-entities';
import { Donor, ClinicalInfo } from '../../clinical/clinical-entities';
import { DeepReadonly } from 'deep-freeze';
import * as clinicalService from '../../clinical/clinical-service';
import * as persistedConfig from '../persisted-config/service';
import * as submissionService from '../submission-service';
import {
  RevalidateClinicalSubmissionCommand,
  SUBMISSION_STATE,
  ClinicalEntityToEnumFieldsMap,
  ClinicalEntityKnownFieldCodeLists,
} from '../submission-entities';
import { notEmpty, Errors, sleep, isEmpty, toString } from '../../utils';
import _ from 'lodash';
import { getClinicalEntitiesFromDonorBySchemaName } from '../../common-model/functions';
import {
  recalculateDonorStatsHoldOverridden,
  setInvalidCoreEntityStatsForMigration,
} from '../submission-to-clinical/stat-calculator';
import { setStatus, Status } from '../../app-health';
import * as messenger from '../submission-updates-messenger';
import * as dictionaryManager from '../../dictionary/manager';
import { ClinicalEntitySchemaNames } from '../../common-model/entities';
import { ValueType } from '@overturebio-stack/lectern-client/lib/schema-entities';

const L = loggerFor(__filename);

export namespace MigrationManager {
  function dictionaryManagerInstance() {
    return dictionaryManager.instance();
  }

  export const dryRunSchemaUpgrade = async (toVersion: string, initiator: string) => {
    const currVersion = await dictionaryManagerInstance().getCurrentVersion();
    return await submitMigration(currVersion, toVersion, initiator, true);
  };

  export const getMigration = async (migrationId: string | undefined) => {
    if (!migrationId) {
      return await migrationRepo.getAll();
    }

    const openMigration = await migrationRepo.getById(migrationId);
    if (!openMigration) {
      throw new Errors.NotFound(`no migration with that id ${migrationId}`);
    }
    return [openMigration];
  };

  export const resumeMigration = async (sync?: boolean) => {
    const openMigration = await migrationRepo.getByState('OPEN');
    if (!openMigration) {
      throw new Errors.NotFound(`No active migration found!`);
    }

    return await runMigrationSyncOrAsync(openMigration, sync || openMigration.dryRun);
  };

  export const submitMigration = async (
    fromVersion: string,
    toVersion: string,
    initiator: string,
    dryRun?: boolean,
    sync?: boolean,
  ) => {
    // can't submit if a migration already open
    const openMigration = await migrationRepo.getByState('OPEN');

    if (openMigration) {
      throw new Errors.StateConflict('A migration is already active');
    }

    const savedMigration = await migrationRepo.create({
      fromVersion,
      toVersion,
      stage: 'SUBMITTED',
      state: 'OPEN',
      createdBy: initiator,
      analysis: undefined,
      dryRun: dryRun || false,
      stats: {
        invalidDocumentsCount: 0,
        totalProcessed: 0,
        validDocumentsCount: 0,
      },
      invalidDonorsErrors: [],
      invalidSubmissions: [],
      checkedSubmissions: [],
      programsWithDonorUpdates: [],
    });

    if (!savedMigration) {
      throw new Error('failed to submit migration');
    }

    return await runMigrationSyncOrAsync(savedMigration, sync || savedMigration.dryRun);
  };

  async function runMigrationSyncOrAsync(
    migrationToRun: DeepReadonly<DictionaryMigration>,
    sync?: boolean,
  ) {
    if (!migrationToRun._id) {
      throw new Error('Migration should have an id');
    }

    const newSchemaVersion = migrationToRun.toVersion;
    const dictionaryName = dictionaryManagerInstance().getCurrentName();
    let newTargetSchema: dictionaryEntities.SchemasDictionary;
    try {
      newTargetSchema = await dictionaryManagerInstance().loadSchemaByVersion(
        dictionaryName,
        newSchemaVersion,
      );
    } catch (err) {
      const message: string =
        "couldn't load new schema, check if the version is correct and try again, " +
        'if problem persists check the logs';
      return await abortMigration(migrationToRun, undefined, message);
    }

    const preMigrateVerification = await verifyNewSchemaIsValidWithDataValidation(newTargetSchema);
    if (!_.isEmpty(preMigrateVerification)) {
      return await abortMigration(migrationToRun, preMigrateVerification);
    }

    // disable submissions system and wait for 2 sec to allow trailing activesubmission operations to complete
    const submissionSystemDisabled = await persistedConfig.setSubmissionDisabledState(true);
    if (!submissionSystemDisabled)
      throw new Error('Failed to disable submissions system, aborting mirgraiton...');
    await sleep(2000);

    // explicit sync so wait till done
    if (sync) {
      return await runMigration(migrationToRun, newTargetSchema);
    }

    // start but **DONT** await on the migration process to finish.
    runMigration(migrationToRun, newTargetSchema);
    return migrationToRun;
  }

  const runMigration = async (
    roMigration: DeepReadonly<DictionaryMigration>,
    newTargetSchema: dictionaryEntities.SchemasDictionary,
  ) => {
    const migration = _.cloneDeep(roMigration) as DictionaryMigration;

    if (!migration._id) {
      throw new Error('Migration should have an id');
    }

    const migrationId = migration._id;

    const migrationAfterDonorCheck = await checkDonorDocuments(migration, newTargetSchema);

    await revalidateOpenSubmissionsWithNewSchema(
      migrationAfterDonorCheck,
      newTargetSchema,
      migration.dryRun,
    );

    // close migration
    const updatedMigration = await migrationRepo.getById(migrationId);
    const migrationToClose = _.cloneDeep(updatedMigration) as DictionaryMigration;

    if (!migrationToClose) {
      throw new Error('where did the migration go? expected migration not found');
    }

    migrationToClose.state = 'CLOSED';
    migrationToClose.stage = 'COMPLETED';
    const closedMigration = await migrationRepo.update(migrationToClose);

    if (!migration.dryRun) {
      await loadNewDictionary(newTargetSchema.version);
      sendMessagesForProgramWithDonorUpdates(migrationAfterDonorCheck.programsWithDonorUpdates);
    }

    await persistedConfig.setSubmissionDisabledState(false);

    return closedMigration;
  };

  const loadNewDictionary = async (version: string) => {
    const dictionaryName = dictionaryManagerInstance().getCurrentName();
    await dictionaryManagerInstance().loadAndSaveNewVersion(dictionaryName, version);
    setStatus('schema', { status: Status.OK });
  };

  const sendMessagesForProgramWithDonorUpdates = (programs: string[]) => {
    programs?.forEach(program => {
      try {
        messenger.getInstance().sendProgramUpdatedMessage(program);
      } catch (e) {
        L.error(`Found error sending update message for program - ${program}: `, e);
      }
    });
  };

  const verifyNewSchemaIsValidWithDataValidation = async (
    newSchemaDictionary: dictionaryEntities.SchemasDictionary,
  ): Promise<NewSchemaVerificationResult> => {
    const verificationResult: NewSchemaVerificationResult = {};

    const currVersion = await dictionaryManagerInstance().getCurrentVersion();
    const currentSchema = await dictionaryManagerInstance().getCurrent();
    const toVersion = newSchemaDictionary.version;

    const analysis = await dictionaryManagerInstance().analyzeChanges(currVersion, toVersion);

    let valueTypeChanges: string[] = [];
    if (!_.isEmpty(analysis.valueTypeChanges)) {
      valueTypeChanges = analysis.valueTypeChanges;
    }

    Object.values(ClinicalEntitySchemaNames).forEach(clinicalEntityName => {
      const clinicalEntityNewSchemaDef = newSchemaDictionary.schemas.find(
        s => s.name === clinicalEntityName,
      );

      const missingDataValidationFields: string[] = checkClinicalEntityNewSchemaHasRequiredFields(
        clinicalEntityName as ClinicalEntitySchemaNames,
        clinicalEntityNewSchemaDef,
      );

      const invalidDataValidationFields: any[] = checkClinicalEntityNewSchemaHasFieldCodeListValues(
        clinicalEntityName as ClinicalEntitySchemaNames,
        clinicalEntityNewSchemaDef,
      );

      const changedValueTypes: string[] = checkValueTypeChanges(
        valueTypeChanges,
        clinicalEntityName as ClinicalEntitySchemaNames,
        currentSchema,
        clinicalEntityNewSchemaDef,
      );

      if (
        missingDataValidationFields.length !== 0 ||
        invalidDataValidationFields.length !== 0 ||
        changedValueTypes.length !== 0
      ) {
        verificationResult[clinicalEntityName] = {
          missingFields: missingDataValidationFields,
          invalidFieldCodeLists: invalidDataValidationFields,
          valueTypeChanges: changedValueTypes,
        };
      }
    });

    return verificationResult;
  };

  function checkClinicalEntityNewSchemaHasRequiredFields(
    clinicalEntityName: ClinicalEntitySchemaNames,
    clinicalEntityNewSchemaDef: dictionaryEntities.SchemaDefinition | undefined,
  ): string[] {
    return _.difference(
      ClinicalEntityToEnumFieldsMap[clinicalEntityName],
      clinicalEntityNewSchemaDef?.fields.map(f => f.name) || [],
    );
  }

  function checkClinicalEntityNewSchemaHasFieldCodeListValues(
    clinicalSchemaName: ClinicalEntitySchemaNames,
    clinicalEntityNewSchemaDef: dictionaryEntities.SchemaDefinition | undefined,
  ) {
    const invalidFields: any = [];
    Object.entries(ClinicalEntityKnownFieldCodeLists[clinicalSchemaName] || {}).forEach(
      ([fieldName, codeList]) => {
        const clinicalEntityNewSchemaFieldDef = clinicalEntityNewSchemaDef?.fields.find(
          nfd => nfd.name === fieldName,
        );
        const missingCodeListValues = _.difference(
          codeList,
          clinicalEntityNewSchemaFieldDef?.restrictions?.codeList || [],
        );
        if (missingCodeListValues.length !== 0) {
          invalidFields.push({ fieldName, missingCodeListValues });
        }
      },
    );
    return invalidFields;
  }

  function checkValueTypeChanges(
    valueTypeChanges: string[],
    clinicalEntityName: ClinicalEntitySchemaNames,
    currentSchema: dictionaryEntities.SchemasDictionary,
    newSchemaEntity: dictionaryEntities.SchemaDefinition | undefined,
  ): string[] {
    const prohibitedChangedFields: string[] = [];
    valueTypeChanges.forEach(change => {
      const changedSchema = change.split('.')[0];
      if (clinicalEntityName === changedSchema) {
        const field: string = change.split('.')[1];
        const changedSchemaBefore = currentSchema.schemas.find(s => s.name === changedSchema);
        const changedFieldBefore = changedSchemaBefore?.fields.find(f => f.name === field);
        const changedValueTypeBefore = changedFieldBefore?.valueType;

        const changedFieldAfter = newSchemaEntity?.fields.find(f => f.name === field);
        const changedValueTypeAfter = changedFieldAfter?.valueType;
        if (!(changedValueTypeBefore && changedValueTypeAfter)) {
          const msg = `Field ${field} in schema ${changedSchema} has value type change, but field or schema are missing in current and new dictionary.`;
          L.error(msg, new Error(msg));
        } else {
          // Only allow valut type change fron intger to number
          if (
            !(
              changedValueTypeBefore === ValueType.INTEGER &&
              changedValueTypeAfter === ValueType.NUMBER
            )
          ) {
            prohibitedChangedFields.push(field);
          }
        }
      }
    });
    return prohibitedChangedFields;
  }

  const abortMigration = async (
    migration: DeepReadonly<DictionaryMigration>,
    newSchemaAnalysis?: NewSchemaVerificationResult,
    errorMessage?: string,
  ) => {
    const migrationToFail = _.cloneDeep(migration) as DictionaryMigration;
    migrationToFail.stage = 'FAILED';
    migrationToFail.state = 'CLOSED';
    if (newSchemaAnalysis != undefined || errorMessage) {
      const newSchemaError = newSchemaAnalysis || errorMessage;
      migrationToFail.newSchemaErrors = newSchemaError;
    }

    const updatedMigration = await migrationRepo.update(migrationToFail);

    await persistedConfig.setSubmissionDisabledState(false);

    return updatedMigration;
  };

  const revalidateOpenSubmissionsWithNewSchema = async (
    migration: DictionaryMigration,
    newSchema: dictionaryEntities.SchemasDictionary,
    dryRun: boolean,
  ) => {
    const submissions = await submissionService.operations.findActiveClinicalSubmissions();

    for (const sub of submissions) {
      if (
        sub.state === SUBMISSION_STATE.INVALID ||
        sub.state === SUBMISSION_STATE.INVALID_BY_MIGRATION
      ) {
        continue;
      }

      const checkedSubmission = migration.checkedSubmissions.find(x => {
        return x._id == sub._id;
      });

      if (checkedSubmission) {
        continue;
      }

      migration.checkedSubmissions.push({
        programId: sub.programId,
        id: sub._id,
      });

      const command: RevalidateClinicalSubmissionCommand = {
        programId: sub.programId,
        migrationId: migration._id as string,
      };

      const result = await submissionService.operations.revalidateClinicalSubmission(
        command,
        newSchema,
        dryRun,
      );

      if (!result.submission) {
        continue;
      }

      if (result.submission.state === 'INVALID_BY_MIGRATION') {
        migration.invalidSubmissions.push({
          programId: sub.programId,
          id: sub._id,
        });
      }

      migration = await migrationRepo.update(migration);
    }
    return migration;
  };

  // start iterating over paged donor documents records (that weren't checked before)
  const checkDonorDocuments = async (
    migration: DictionaryMigration,
    newSchema: dictionaryEntities.SchemasDictionary,
  ) => {
    let migrationDone = false;
    if (!migration._id) {
      throw new Error('Migration should have an id');
    }
    const migrationId = migration._id;
    const dryRun = migration.dryRun;
    const breakingChangesEntitesCache: { [versions: string]: ClinicalEntitySchemaNames[] } = {};
    const coreFieldChangesEntitiesCache: { [versions: string]: ClinicalEntitySchemaNames[] } = {};

    while (!migrationDone) {
      let invalidCount = 0;
      let validCount = 0;
      const donors = await getNextUncheckedDonorDocumentsBatch(migrationId, 20);
      const programsWithChanges: Set<string> = new Set(migration.programsWithDonorUpdates);

      // no more unchecked donors ??
      if (donors.length == 0) {
        // mark migration as done
        migrationDone = true;
        break;
      }

      // check invalidation criteria against each one
      for (const donor of donors) {
        await updateCaches(
          donor,
          newSchema,
          coreFieldChangesEntitiesCache,
          breakingChangesEntitesCache,
        );

        const result = await revalidateDonorClinicalEntities(
          donor,
          newSchema,
          breakingChangesEntitesCache,
        );
        if (result && result.length > 0) {
          // if invalid mark as invalid and update document metadata
          if (!dryRun) {
            const updatedDonor = await updateStatsForInvalidDonorToBe(donor, result);
            const invalidDonor = await markDonorAsInvalid(updatedDonor, migrationId);
            updateSetOfProgramsWithChanges(donor, invalidDonor, programsWithChanges);
          } else {
            await updateMigrationIdOnly(donor, migrationId);
          }

          migration.invalidDonorsErrors.push({
            donorId: donor.donorId,
            submitterDonorId: donor.submitterId,
            programId: donor.programId,
            errors: result,
          });

          invalidCount += 1;
          continue;
        }

        if (!dryRun) {
          const updatedDonor = await updateStatsForValidDonorToBe(donor);
          const validDonor = await markDonorAsValid(updatedDonor, migrationId, newSchema.version);
          updateSetOfProgramsWithChanges(donor, validDonor, programsWithChanges);
        } else {
          await updateMigrationIdOnly(donor, migrationId);
        }
        validCount += 1;
      }

      migration.stats.invalidDocumentsCount += invalidCount;
      migration.stats.validDocumentsCount += validCount;
      migration.stats.totalProcessed += donors.length;
      migration.programsWithDonorUpdates = Array.from(programsWithChanges);
      migration = await migrationRepo.update(migration);
    }
    return migration;
  };

  const updateSetOfProgramsWithChanges = (
    donorBeforeMigration: DeepReadonly<Donor>,
    donorAfterMigration: DeepReadonly<Donor>,
    programsWithChanges: Set<string>,
  ) => {
    const programIsBeingUpdated =
      donorBeforeMigration.schemaMetadata.isValid !== donorAfterMigration.schemaMetadata.isValid ||
      !_.isEqual(donorBeforeMigration.completionStats, donorAfterMigration.completionStats);
    if (programIsBeingUpdated) {
      programsWithChanges.add(donorAfterMigration.programId);
    }
  };

  const getNextUncheckedDonorDocumentsBatch = async (migrationId: string, limit: number) => {
    return await clinicalService.getDonorsByMigrationId(migrationId, limit);
  };

  const updateCaches = async (
    donor: DeepReadonly<Donor>,
    newSchema: dictionaryEntities.SchemasDictionary,
    coreFieldUpdatedSchemaNamesCache: { [versionsKey: string]: ClinicalEntitySchemaNames[] },
    breakingChangesEntitesCache: { [versionsKey: string]: ClinicalEntitySchemaNames[] },
  ) => {
    const versionsKey = `${donor.schemaMetadata.lastValidSchemaVersion}->${newSchema.version}`;

    if (
      !breakingChangesEntitesCache[versionsKey] ||
      !coreFieldUpdatedSchemaNamesCache[versionsKey]
    ) {
      L.debug(`didn't find cached analysis for versions: ${versionsKey}`);
      // analyze changes between the document last valid schema
      const analysis = await dictionaryManagerInstance().analyzeChanges(
        donor.schemaMetadata.lastValidSchemaVersion,
        newSchema.version,
      );

      // check for schema names with breaking changes
      const invalidatingFields: any = findInvalidatingChangesFields(analysis);

      const schemaNamesWithBreakingChanges = _.uniqBy(
        invalidatingFields.map((inf: any) => {
          return inf.fieldPath.split('.')[0];
        }),
        (e: string) => e,
      ) as ClinicalEntitySchemaNames[];
      // update breaking changes cache
      breakingChangesEntitesCache[versionsKey] = schemaNamesWithBreakingChanges;

      // update schema names that require core field recalculations cache
      coreFieldUpdatedSchemaNamesCache[versionsKey] = findEntitiesWithCoreDesignationChanges(
        analysis,
      );
    }
  };

  const revalidateDonorClinicalEntities = async (
    donor: DeepReadonly<Donor>,
    newSchema: dictionaryEntities.SchemasDictionary,
    breakingChangesEntitesCache: { [versions: string]: ClinicalEntitySchemaNames[] },
  ) => {
    const donorSchemaErrors: DonorMigrationSchemaErrors = [];
    const donorDocSchemaVersion = donor.schemaMetadata.lastValidSchemaVersion;
    const versionsKey = `${donorDocSchemaVersion}->${newSchema.version}`;

    const schemaNamesWithBreakingChanges = breakingChangesEntitesCache[versionsKey];
    for (const schemaName of schemaNamesWithBreakingChanges) {
      // not fields since we only need to check the whole schema once.
      const errors = validateDonorEntityAgainstNewSchema(schemaName, newSchema, donor);
      if (errors && errors.length > 0) {
        donorSchemaErrors.push({
          [schemaName]: errors,
        });
      }
    }
    return donorSchemaErrors;
  };

  const updateStatsForInvalidDonorToBe = async (
    donorBeforeSetInvalid: DeepReadonly<Donor>,
    results: DonorMigrationSchemaErrors,
  ) => {
    const invalidEntities = results.map(r => Object.keys(r)).flat();
    return setInvalidCoreEntityStatsForMigration(donorBeforeSetInvalid, invalidEntities);
  };

  const updateStatsForValidDonorToBe = async (donorBeforeSetValid: DeepReadonly<Donor>) => {
    // donor has no aggregated stats or it was previously invalid, so need to calculate for entire donor
    if (
      isEmpty(donorBeforeSetValid.completionStats) ||
      !donorBeforeSetValid.schemaMetadata.isValid
    ) {
      return recalculateDonorStatsHoldOverridden(_.cloneDeep(donorBeforeSetValid) as Donor);
    }
    return donorBeforeSetValid;
  };

  export const validateDonorEntityAgainstNewSchema = (
    schemaName: ClinicalEntitySchemaNames,
    schema: dictionaryEntities.SchemasDictionary,
    donor: DeepReadonly<Donor>,
  ) => {
    L.debug(`checking donor ${donor.submitterId} for schema: ${schemaName}`);
    // todoo replace with clinical info definition
    const clinicalRecords: ClinicalInfo[] = getClinicalEntitiesFromDonorBySchemaName(
      donor as Donor,
      schemaName as ClinicalEntitySchemaNames,
    );
    if (!clinicalRecords || clinicalRecords.length == 0) {
      return undefined;
    }
    const stringifyedRecords = clinicalRecords
      .map(cr => {
        return prepareForSchemaReProcessing(cr);
      })
      .filter(notEmpty);
    const result = dictionaryService.processRecords(schema, schemaName, stringifyedRecords);
    if (result.validationErrors.length > 0) {
      return result.validationErrors;
    }
    return undefined;
  };

  function prepareForSchemaReProcessing(record: object) {
    // we copy to avoid frozen attributes
    const copy = _.cloneDeep(record);
    return toString(copy);
  }

  const markDonorAsInvalid = async (donor: DeepReadonly<Donor>, migrationId: string) => {
    return await clinicalService.updateDonorSchemaMetadata(donor, migrationId, false);
  };

  const markDonorAsValid = async (
    donor: DeepReadonly<Donor>,
    migrationId: string,
    newSchemaVersion: string,
  ) => {
    return await clinicalService.updateDonorSchemaMetadata(
      donor,
      migrationId,
      true,
      newSchemaVersion,
    );
  };

  const updateMigrationIdOnly = async (donor: DeepReadonly<Donor>, migrationId: string) => {
    return await clinicalService.updateMigrationId(donor, migrationId);
  };

  export const findInvalidatingChangesFields = (
    changeAnalysis: dictionaryEntities.ChangeAnalysis,
  ) => {
    const invalidatingFields: any = [];

    /**************
     * CODELISTS
     ***************/
    // if we added a codeList restriction -> check other values
    changeAnalysis.restrictionsChanges.codeList.created.forEach(cc => {
      invalidatingFields.push({
        type: 'CODELIST_ADDED',
        fieldPath: cc.field,
        noLongerValid: undefined, // this has to be changed to represent the set of All possible values
      });
    });

    // if we modifed codeList restriction, check for no longer valid values
    changeAnalysis.restrictionsChanges.codeList.updated.forEach(cc => {
      invalidatingFields.push({
        type: 'CODELIST_UPDATED',
        fieldPath: cc.field,
      });
    });

    /**************
     * REGEX
     ***************/
    changeAnalysis.restrictionsChanges.regex.created.forEach(rc => {
      invalidatingFields.push({
        type: 'REGEX_ADDED',
        fieldPath: rc.field,
        newValidValue: rc.definition,
      });
    });

    changeAnalysis.restrictionsChanges.regex.updated.forEach(rc => {
      invalidatingFields.push({
        type: 'REGEX_UPDATED',
        fieldPath: rc.field,
        newValidValue: rc.definition,
      });
    });

    /**************
     * Required restrictions set
     ***************/
    changeAnalysis.restrictionsChanges.required.created.forEach(rc => {
      // if required added with value true
      if (rc.definition) {
        invalidatingFields.push({
          type: 'REQUIRED_SET',
          fieldPath: rc.field,
          newValidValue: rc.definition,
        });
      }
    });

    changeAnalysis.restrictionsChanges.required.updated.forEach(rc => {
      // if required added with value true
      if (rc.definition) {
        invalidatingFields.push({
          type: 'REQUIRED_SET',
          fieldPath: rc.field,
          newValidValue: rc.definition,
        });
      }
    });

    // ******************
    // Adding new required field
    // ******************
    changeAnalysis.fields.addedFields.forEach(rc => {
      if (rc.definition.restrictions && rc.definition.restrictions.required) {
        invalidatingFields.push({
          type: 'REQUIRED_FIELD_ADDED',
          fieldPath: rc.name,
        });
      }
    });

    // ******************
    // Removing a field
    // ******************
    changeAnalysis.fields.deletedFields.forEach(rc => {
      invalidatingFields.push({
        type: 'FIELD_REMOVED',
        fieldPath: rc,
      });
    });

    // ******************
    // Scripts
    // ******************
    changeAnalysis.restrictionsChanges.script.created.forEach(rc => {
      invalidatingFields.push({
        type: 'SCRIPT_ADDED',
        fieldPath: rc.field,
        newValidValue: rc.definition,
      });
    });

    changeAnalysis.restrictionsChanges.script.updated.forEach(rc => {
      invalidatingFields.push({
        type: 'SCRIPT_UPDATED',
        fieldPath: rc.field,
        newValidValue: rc.definition,
      });
    });

    // ******************
    // Ranges
    // ******************
    changeAnalysis.restrictionsChanges.range.created.forEach(rc => {
      invalidatingFields.push({
        type: 'RANGE_ADDED',
        fieldPath: rc.field,
      });
    });

    changeAnalysis.restrictionsChanges.range.updated.forEach(rc => {
      invalidatingFields.push({
        type: 'RANGE_UPDATED',
        fieldPath: rc.field,
      });
    });

    // ******************
    // isArray designation
    // ******************
    changeAnalysis.isArrayDesignationChanges.forEach(fp => {
      invalidatingFields.push({
        type: 'IS_ARRAY_CHANGED',
        fieldPath: fp,
      });
    });

    return invalidatingFields;
  };

  const findEntitiesWithCoreDesignationChanges = (
    changeAnalysis: dictionaryEntities.ChangeAnalysis,
  ) => {
    const fieldPathsChangingCoreValue: string[] = [];

    //  schema with added fields that are core need to be recalculated
    changeAnalysis.fields.addedFields.forEach(f => {
      if (f.definition.meta?.core) {
        fieldPathsChangingCoreValue.push(f.name);
      }
    });

    //  schema with deleted fields need to be recalculated
    changeAnalysis.fields.deletedFields.forEach(f => {
      fieldPathsChangingCoreValue.push(f);
    });

    //  schema with fields changed to core need to be recalculated
    changeAnalysis.metaChanges?.core.changedToCore.forEach(f => {
      fieldPathsChangingCoreValue.push(f);
    });

    //  schema with fields that are not core anymore need to be recalculated
    changeAnalysis.metaChanges?.core.changedFromCore.forEach(f => {
      fieldPathsChangingCoreValue.push(f);
    });

    const uniqueSchemasWithChangingCoreFields = _.uniqBy(
      fieldPathsChangingCoreValue.map((fieldPath: any) => {
        return fieldPath.split('.')[0];
      }),
      (e: string) => e,
    ) as ClinicalEntitySchemaNames[];

    return uniqueSchemasWithChangingCoreFields;
  };
}
