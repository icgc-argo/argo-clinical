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
import { Donor } from '../../clinical/clinical-entities';
import { DeepReadonly } from 'deep-freeze';
import * as clinicalService from '../../clinical/clinical-service';
import { ClinicalEntityType } from '../submission-entities';
import { notEmpty, Errors } from '../../utils';
import _ from 'lodash';
const L = loggerFor(__filename);

let manager: SchemaManager;

class SchemaManager {
  private currentSchema: SchemasDictionary = {
    schemas: [],
    name: '',
    version: '',
  };
  constructor(private schemaServiceUrl: string) {}

  getCurrent = (): SchemasDictionary => {
    return this.currentSchema;
  };

  getSubSchemasList = (): string[] => {
    return this.currentSchema.schemas.map(s => s.name);
  };

  getSubSchemaFieldNamesWithPriority = (definition: string): FieldNamesByPriorityMap => {
    return service.getSubSchemaFieldNamesWithPriority(this.currentSchema, definition);
  };

  /**
   * This method does three things:
   * 1- populate default values for missing fields
   * 2- validate the record against the schema
   * 3- convert the raw data from strings to their proper type if needed.
   *
   * @param schemaName the schema we want to process records for
   * @param records the raw records list
   *
   * @returns object contains the validation errors and the valid processed records.
   */
  process = (schemaName: string, records: ReadonlyArray<DataRecord>): SchemaProcessingResult => {
    if (this.getCurrent() === undefined) {
      throw new Error('schema manager not initialized correctly');
    }
    return service.process(this.getCurrent(), schemaName, records);
  };

  analyzeChanges = async (oldVersion: string, newVersion: string) => {
    const result = await changeAnalyzer.fetchDiffAndAnalyze(
      this.schemaServiceUrl,
      this.currentSchema.name,
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
    this.currentSchema = result;
    return this.currentSchema;
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
    this.currentSchema = result;
    return this.currentSchema;
  };

  loadSchemaAndSave = async (name: string, initialVersion: string): Promise<SchemasDictionary> => {
    L.debug(`in loadSchema ${initialVersion}`);
    if (!initialVersion) {
      throw new Error('initial version cannot be empty.');
    }
    const storedSchema = await schemaRepo.get(name);
    if (storedSchema === null) {
      L.info(`schema not found in db`);
      this.currentSchema = {
        schemas: [],
        name: name,
        version: initialVersion,
      };
    } else {
      L.info(`schema found in db`);
      this.currentSchema = storedSchema;
    }

    // if the schema is not complete we need to load it from the
    // schema service (lectern)
    if (!this.currentSchema.schemas || this.currentSchema.schemas.length === 0) {
      L.debug(`fetching schema from schema service.`);
      const result = await this.loadSchemaByVersion(name, this.currentSchema.version);
      L.info(`fetched schema ${result.version}`);
      this.currentSchema.schemas = result.schemas;
      const saved = await schemaRepo.createOrUpdate(this.currentSchema);
      if (!saved) {
        throw new Error("couldn't save/update new schema");
      }
      L.info(`schema saved in db`);
      return saved;
    }
    return this.currentSchema;
  };

  updateSchemaVersion = async (toVersion: string, updater: string, sync?: boolean) => {
    // submit the migration request
    await MigrationManager.submitMigration(this.getCurrent().version, toVersion, updater);
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
}

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
    });

    if (!savedMigration) {
      throw new Error('failed to submit migration');
    }

    if (dryRun) {
      const result = await startMigration(savedMigration);
      return result;
    }

    if (sync) {
      await startMigration(savedMigration);
      return savedMigration;
    }

    // start but **DONT** await on the migration process to finish.
    startMigration(savedMigration);
    return savedMigration;
  };

  const startMigration = async (roMigration: DeepReadonly<DictionaryMigration>) => {
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

    await checkDonorDocuments(migration, newTargetSchema);

    // close migration
    const updatedMigration = await migrationRepo.getById(migrationId);
    const migrationToClose = _.cloneDeep(updatedMigration) as DictionaryMigration;
    if (!migrationToClose) {
      throw new Error('where did the migration go? expected migration not found');
    }
    migrationToClose.state = 'CLOSED';
    migrationToClose.stage = 'COMPLETED';
    const closedMigration = await migrationRepo.update(migrationToClose);
    return closedMigration;
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
    const breakingChangesEntitesCache: { [versions: string]: string[] } = {};

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
  };

  const getNextUncheckedDonorDocumentsBatch = async (migrationId: string, limit: number) => {
    return await clinicalService.getDonorsByMigrationId(migrationId, limit);
  };

  const revalidateDonorClinicalEntities = async (
    donor: DeepReadonly<Donor>,
    newSchema: SchemasDictionary,
    breakingChangesEntitesCache: { [versions: string]: string[] },
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
      );
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

  const validateDonorEntityAgainstNewSchema = (
    schemaName: string,
    schema: SchemasDictionary,
    donor: DeepReadonly<Donor>,
  ) => {
    L.debug(`checking donor ${donor.submitterId} for schema: ${schemaName}`);

    if (schemaName == ClinicalEntityType.DONOR) {
      if (donor.clinicalInfo) {
        const result = service.process(schema, schemaName, [
          prepareForSchemaReProcessing(donor.clinicalInfo),
        ]);
        if (result.validationErrors.length > 0) {
          return result.validationErrors;
        }
      }
    }

    if (schemaName == ClinicalEntityType.SPECIMEN) {
      const clinicalRecords = donor.specimens
        .map(sp => {
          if (sp.clinicalInfo) {
            return prepareForSchemaReProcessing(sp.clinicalInfo);
          }
        })
        .filter(notEmpty);
      const result = service.process(schema, schemaName, clinicalRecords);
      if (result.validationErrors.length > 0) {
        return result.validationErrors;
      }
    }

    const donorFieldName = _.camelCase(schemaName) as keyof Donor;
    const clinicalEntity = (donor[donorFieldName] as object) || undefined;

    if (!clinicalEntity) {
      return undefined;
    }

    if (_.isArray(clinicalEntity)) {
      const records = clinicalEntity
        .map(ce => {
          return prepareForSchemaReProcessing(ce);
        })
        .filter(notEmpty);

      const result = service.process(schema, schemaName, records);
      if (result.validationErrors.length > 0) {
        return result.validationErrors;
      }
    }

    const result = service.process(schema, schemaName, [
      prepareForSchemaReProcessing(clinicalEntity),
    ]);

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
