import * as service from '../../lectern-client/schema-functions';
import {
  SchemasDictionary,
  DataRecord,
  SchemaProcessingResult,
  FieldNamesByPriorityMap,
  ChangeAnalysis,
} from '../../lectern-client/schema-entities';
import * as changeAnalyzer from '../../lectern-client/change-analyzer';
import { schemaClient as schemaServiceAdapter } from '../../lectern-client/schema-rest-client';
import { schemaRepo } from './schema-repo';
import { loggerFor } from '../../logger';
import { migrationRepo } from './migration-repo';
import { DictionaryMigration } from './migration-entities';
import { Donor, ClinicalInfo } from '../../clinical/clinical-entities';
import { DeepReadonly } from 'deep-freeze';
import * as clinicalService from '../../clinical/clinical-service';
import * as persistedConfig from '../persisted-config/service';
import * as submissionService from '../submission-service';
import {
  ClinicalEntitySchemaNames,
  RevalidateClinicalSubmissionCommand,
  SUBMISSION_STATE,
} from '../submission-entities';
import { notEmpty, Errors, sleep } from '../../utils';
import _ from 'lodash';
import { getClinicalEntitiesFromDonorBySchemaName } from '../submission-to-clinical/submission-to-clinical';
const L = loggerFor(__filename);

let manager: SchemaManager;

class SchemaManager {
  private currentSchemaDictionary: SchemasDictionary = {
    schemas: [],
    name: '',
    version: '',
  };
  constructor(private schemaServiceUrl: string) {}

  getCurrent = (): SchemasDictionary => {
    return this.currentSchemaDictionary;
  };

  getSchemasWithFields = (): {
    name: string;
    fields: string[];
  }[] => {
    return this.currentSchemaDictionary.schemas.map(s => {
      return {
        name: s.name,
        fields: s.fields.map(f => f.name),
      };
    });
  };

  getSchemas = (): string[] => {
    return this.currentSchemaDictionary.schemas.map(s => s.name);
  };

  getSchemaFieldNamesWithPriority = (definition: string): FieldNamesByPriorityMap => {
    return service.getSchemaFieldNamesWithPriority(this.currentSchemaDictionary, definition);
  };

  /**
   * This method does three things:
   * 1- populate default values for empty optional fields
   * 2- validate the record against the schema
   * 3- convert the raw data from strings to their proper type if needed.
   *
   * @param schemaName the schema we want to process records for
   * @param records the raw records list
   *
   * @returns object contains the validation errors and the valid processed records.
   */
  process = (
    schemaName: string,
    record: Readonly<DataRecord>,
    index: number,
    schema?: SchemasDictionary,
  ): SchemaProcessingResult => {
    if (!schema && this.getCurrent() === undefined) {
      throw new Error('schema manager not initialized correctly');
    }
    return service.process(schema || this.getCurrent(), schemaName, record, index);
  };

  analyzeChanges = async (oldVersion: string, newVersion: string) => {
    const result = await changeAnalyzer.fetchDiffAndAnalyze(
      this.schemaServiceUrl,
      this.currentSchemaDictionary.name,
      oldVersion,
      newVersion,
    );
    return result;
  };

  loadAndSaveNewVersion = async (name: string, newVersion: string): Promise<SchemasDictionary> => {
    const newSchema = await this.loadSchemaByVersion(name, newVersion);
    const result = await schemaRepo.createOrUpdate(newSchema);
    if (!result) {
      throw new Error("couldn't save/update new schema.");
    }
    this.currentSchemaDictionary = result;
    return this.currentSchemaDictionary;
  };

  loadSchemaByVersion = async (name: string, version: string): Promise<SchemasDictionary> => {
    const newSchema = await schemaServiceAdapter.fetchSchema(this.schemaServiceUrl, name, version);
    return newSchema;
  };

  replace = async (newSchema: SchemasDictionary): Promise<SchemasDictionary> => {
    const result = await schemaRepo.createOrUpdate(newSchema);
    if (!result) {
      throw new Error("couldn't save/update new schema.");
    }
    this.currentSchemaDictionary = result;
    return this.currentSchemaDictionary;
  };

  loadSchemaAndSave = async (name: string, initialVersion: string): Promise<SchemasDictionary> => {
    L.debug(`in loadSchema ${initialVersion}`);
    if (!initialVersion) {
      throw new Error('initial version cannot be empty.');
    }
    const storedSchema = await schemaRepo.get(name);
    if (storedSchema === null) {
      L.info(`schema not found in db`);
      this.currentSchemaDictionary = {
        schemas: [],
        name: name,
        version: initialVersion,
      };
    } else {
      L.info(`schema found in db`);
      this.currentSchemaDictionary = storedSchema;
    }

    // if the schema is not complete we need to load it from the
    // schema service (lectern)
    if (
      !this.currentSchemaDictionary.schemas ||
      this.currentSchemaDictionary.schemas.length === 0
    ) {
      L.debug(`fetching schema from schema service.`);
      const result = await this.loadSchemaByVersion(name, this.currentSchemaDictionary.version);
      L.info(`fetched schema ${result.version}`);
      this.currentSchemaDictionary.schemas = result.schemas;
      const saved = await schemaRepo.createOrUpdate(this.currentSchemaDictionary);
      if (!saved) {
        throw new Error("couldn't save/update new schema");
      }
      L.info(`schema saved in db`);
      return saved;
    }
    return this.currentSchemaDictionary;
  };

  updateSchemaVersion = async (toVersion: string, updater: string, sync?: boolean) => {
    // submit the migration request
    await MigrationManager.submitMigration(
      this.getCurrent().version,
      toVersion,
      updater,
      false,
      sync,
    );
    // update the existing schema
    await this.loadAndSaveNewVersion(this.getCurrent().name, toVersion);
  };

  probeSchemaUpgrade = async (from: string, to: string) => {
    const analysis = await this.analyzeChanges(from, to);
    const breakingChanges = MigrationManager.findInvalidatingChangesFields(analysis);
    return {
      analysis,
      breakingChanges,
    };
  };

  dryRunSchemaUpgrade = async (toVersion: string, initiator: string) => {
    return await MigrationManager.dryRunSchemaUpgrade(toVersion, initiator);
  };

  getMigration = async (migrationId: string | undefined) => {
    return await MigrationManager.getMigration(migrationId);
  };

  resumeMigration = async (sync: boolean) => {
    return await MigrationManager.resumeMigration(sync);
  };
}

export const revalidateAllDonorClinicalEntitiesAgainstSchema = (
  donor: DeepReadonly<Donor>,
  schema: SchemasDictionary,
) => {
  const clinicalSchemaNames = getSchemaNamesForDonorClinicalEntities(donor);
  let isValid = true;
  clinicalSchemaNames.forEach((schemaName: ClinicalEntitySchemaNames) => {
    if (!isValid) {
      return;
    }
    const errs = MigrationManager.validateDonorEntityAgainstNewSchema(schemaName, schema, donor);
    isValid = !errs || errs.length == 0;
  });
  return isValid;
};

const getSchemaNamesForDonorClinicalEntities = (donor: DeepReadonly<Donor>) => {
  const result: ClinicalEntitySchemaNames[] = [];
  for (const key of Object.values(ClinicalEntitySchemaNames)) {
    const clinicalRecords = getClinicalEntitiesFromDonorBySchemaName(donor, key);

    if (clinicalRecords.length > 0) {
      result.push(key);
    }
  }
  return result;
};

export function instance() {
  if (manager === undefined) {
    throw new Error('manager not initialized, you should call create first');
  }
  return manager;
}

export function create(schemaServiceUrl: string) {
  manager = new SchemaManager(schemaServiceUrl);
}

namespace MigrationManager {
  export const dryRunSchemaUpgrade = async (toVersion: string, initiator: string) => {
    return await submitMigration(instance().getCurrent().version, toVersion, initiator, true);
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
    // disable submissions system and wait for 2 sec to allow trailing activesubmission operations to complete
    const submissionSystemDisabled = await persistedConfig.setSubmissionDisabledState(true);
    if (!submissionSystemDisabled)
      throw new Error('Failed to disable submissions system, aborting mirgraiton...');
    await sleep(2000);

    // explicit sync so wait till done
    if (sync) {
      const result = await runMigration(migrationToRun);
      return result;
    }

    // start but **DONT** await on the migration process to finish.
    runMigration(migrationToRun);
    return migrationToRun;
  }

  const runMigration = async (roMigration: DeepReadonly<DictionaryMigration>) => {
    const migration = _.cloneDeep(roMigration) as DictionaryMigration;

    if (!migration._id) {
      throw new Error('Migration should have an id');
    }

    const migrationId = migration._id;
    const newSchemaVersion = migration.toVersion;

    const newTargetSchema = await instance().loadSchemaByVersion(
      instance().getCurrent().name,
      newSchemaVersion,
    );

    const migrationAfterDonorCheck = await checkDonorDocuments(migration, newTargetSchema);

    const migrationAfterSubmissionsCheck = await revalidateOpenSubmissionsWithNewSchema(
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

    await persistedConfig.setSubmissionDisabledState(false);

    return closedMigration;
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

    while (!migrationDone) {
      let invalidCount = 0;
      let validCount = 0;
      const donors = await getNextUncheckedDonorDocumentsBatch(migrationId, 20);
      // no more unchecked donors ??
      if (donors.length == 0) {
        // mark migration as done
        migrationDone = true;
        break;
      }

      // check invalidation criteria against each one
      for (const donor of donors) {
        const result = await revalidateDonorClinicalEntities(
          donor,
          newSchema,
          breakingChangesEntitesCache,
        );
        if (result && result.length > 0) {
          // if invalid mark as invalid and update document metadata
          if (!dryRun) {
            await markDonorAsInvalid(donor, migrationId);
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
          await markDonorAsValid(donor, migrationId, newSchema.version);
        } else {
          await updateMigrationIdOnly(donor, migrationId);
        }
        validCount += 1;
      }

      migration.stats.invalidDocumentsCount += invalidCount;
      migration.stats.validDocumentsCount += validCount;
      migration.stats.totalProcessed += donors.length;
      migration = await migrationRepo.update(migration);
    }
    return migration;
  };

  const getNextUncheckedDonorDocumentsBatch = async (migrationId: string, limit: number) => {
    return await clinicalService.getDonorsByMigrationId(migrationId, limit);
  };

  const revalidateDonorClinicalEntities = async (
    donor: DeepReadonly<Donor>,
    newSchema: SchemasDictionary,
    breakingChangesEntitesCache: { [versions: string]: ClinicalEntitySchemaNames[] },
  ) => {
    const donorSchemaErrors: any[] = [];
    const donorDocSchemaVersion = donor.schemaMetadata.lastValidSchemaVersion;
    const versionsKey = `${donorDocSchemaVersion}->${newSchema.version}`;

    if (!breakingChangesEntitesCache[versionsKey]) {
      L.debug(`didn't find cached changes analysis for versions: ${versionsKey}`);
      // analyze changes between the document last valid schema
      const analysis = await instance().analyzeChanges(
        donor.schemaMetadata.lastValidSchemaVersion,
        newSchema.version,
      );

      // check for breaking changes
      const invalidatingFields: any = findInvalidatingChangesFields(analysis);

      const schemaNamesWithBreakingChanges = _.uniqBy(
        invalidatingFields.map((inf: any) => {
          return inf.fieldPath.split('.')[0];
        }),
        (e: string) => e,
      ) as ClinicalEntitySchemaNames[];
      breakingChangesEntitesCache[versionsKey] = schemaNamesWithBreakingChanges;
    }

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

  function toString(obj: any) {
    if (!obj) {
      return undefined;
    }
    Object.keys(obj).forEach(k => {
      if (typeof obj[k] === 'object') {
        return toString(obj[k]);
      }
      obj[k] = `${obj[k]}`;
    });

    return obj;
  }
}
