import * as service from '../../lectern-client/schema-functions';
import {
  SchemasDictionary,
  ChangeAnalysis,
  SchemaDefinition,
} from '../../lectern-client/schema-entities';
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

const L = loggerFor(__filename);

export namespace MigrationManager {
  function dictionaryManagerInstance() {
    return dictionaryManager.instance();
  }

  export const dryRunSchemaUpgrade = async (toVersion: string, initiator: string) => {
    return await submitMigration(
      dictionaryManagerInstance().getCurrent().version,
      toVersion,
      initiator,
      true,
    );
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
    const newTargetSchema = await dictionaryManagerInstance().loadSchemaByVersion(
      dictionaryManagerInstance().getCurrent().name,
      newSchemaVersion,
    );

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
    newTargetSchema: SchemasDictionary,
  ) => {
    const migration = _.cloneDeep(roMigration) as DictionaryMigration;

    if (!migration._id) {
      throw new Error('Migration should have an id');
    }

    const migrationId = migration._id;

    const migrationAfterDonorCheck = await checkDonorDocuments(migration, newTargetSchema);

    sendMessagesForProgramWithDonorUpdates(migrationAfterDonorCheck.programsWithDonorUpdates);

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

    await dictionaryManagerInstance().loadAndSaveNewVersion(
      dictionaryManagerInstance().getCurrent().name,
      newTargetSchema.version,
    );
    setStatus('schema', { status: Status.OK });

    await persistedConfig.setSubmissionDisabledState(false);

    return closedMigration;
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
    newSchemaDictionary: SchemasDictionary,
  ): Promise<NewSchemaVerificationResult> => {
    const verificationResult: NewSchemaVerificationResult = {};

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

      if (missingDataValidationFields.length !== 0 || invalidDataValidationFields.length !== 0) {
        verificationResult[clinicalEntityName] = {
          missingFields: missingDataValidationFields,
          invalidFieldCodeLists: invalidDataValidationFields,
        };
      }
    });

    return verificationResult;
  };

  function checkClinicalEntityNewSchemaHasRequiredFields(
    clinicalEntityName: ClinicalEntitySchemaNames,
    clinicalEntityNewSchemaDef: SchemaDefinition | undefined,
  ): string[] {
    return _.difference(
      ClinicalEntityToEnumFieldsMap[clinicalEntityName],
      clinicalEntityNewSchemaDef?.fields.map(f => f.name) || [],
    );
  }

  function checkClinicalEntityNewSchemaHasFieldCodeListValues(
    clinicalSchemaName: ClinicalEntitySchemaNames,
    clinicalEntityNewSchemaDef: SchemaDefinition | undefined,
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

  const abortMigration = async (
    migration: DeepReadonly<DictionaryMigration>,
    newSchemaAnalysis?: NewSchemaVerificationResult,
  ) => {
    const migrationToFail = _.cloneDeep(migration) as DictionaryMigration;
    migrationToFail.stage = 'FAILED';
    migrationToFail.state = 'CLOSED';
    if (newSchemaAnalysis) {
      migrationToFail.newSchemaErrors = newSchemaAnalysis;
    }

    const updatedMigration = await migrationRepo.update(migrationToFail);

    await persistedConfig.setSubmissionDisabledState(false);

    return updatedMigration;
  };

  const revalidateOpenSubmissionsWithNewSchema = async (
    migration: DictionaryMigration,
    newSchema: SchemasDictionary,
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
    newSchema: SchemasDictionary,
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
    newSchema: SchemasDictionary,
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
    newSchema: SchemasDictionary,
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
    schema: SchemasDictionary,
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
    const result = service.processRecords(schema, schemaName, stringifyedRecords);
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

  export const findInvalidatingChangesFields = (changeAnalysis: ChangeAnalysis) => {
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

    return invalidatingFields;
  };

  const findEntitiesWithCoreDesignationChanges = (changeAnalysis: ChangeAnalysis) => {
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