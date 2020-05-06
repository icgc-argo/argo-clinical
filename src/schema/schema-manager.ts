import * as service from '../lectern-client/schema-functions';
import * as parallelService from '../lectern-client/parallel';
import {
  SchemasDictionary,
  DataRecord,
  SchemaProcessingResult,
  FieldNamesByPriorityMap,
} from '../lectern-client/schema-entities';
import * as changeAnalyzer from '../lectern-client/change-analyzer';
import { schemaClient as schemaServiceAdapter } from '../lectern-client/schema-rest-client';
import { schemaRepo } from './schema-repo';
import { loggerFor } from '../logger';
import { Donor } from '../clinical/clinical-entities';
import { DeepReadonly } from 'deep-freeze';
import { ClinicalEntitySchemaNames } from '../common-model/entities';
import _ from 'lodash';
import { getClinicalEntitiesFromDonorBySchemaName } from '../submission/submission-to-clinical/submission-to-clinical';
import { MigrationManager } from '../submission/migration/migration-manager';
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

  getSchemasWithFields = (
    schemaDefConstratint: object | Function = {}, // k-v SchemaDefinition property constraints; e.g. { name: 'donor' } or function executed on each schema def
    fieldDefConstraint: object | Function = {}, // k-v FieldDefinition property constraints; e.g. { restrictions: { required: true } }  or function executed on each field def
  ): {
    name: string;
    fields: string[];
  }[] => {
    return _(this.currentSchemaDictionary.schemas)
      .filter(schemaDefConstratint)
      .map(s => {
        return {
          name: s.name,
          fields: _(s.fields)
            .filter(fieldDefConstraint)
            .map(f => f.name)
            .value(),
        };
      })
      .value();
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

  /**
   * This method does same thing as normal process, however it utilises
   * worker threads to parallelise record processing.
   *
   * @see process
   *
   * @param schemaName the schema we want to process records for
   * @param records the raw records list
   * @param index the original record index
   * @param schemasDictionary optional schema to use for validation
   * @returns promise object contains the validation errors
   *          and the valid processed records.
   */
  processAsync = async (
    schemaName: string,
    record: Readonly<DataRecord>,
    index: number,
    schemasDictionary?: SchemasDictionary,
  ): Promise<SchemaProcessingResult> => {
    if (!schemasDictionary && this.getCurrent() === undefined) {
      throw new Error('schema manager not initialized correctly');
    }
    return await parallelService.processRecord(
      schemasDictionary || this.getCurrent(),
      schemaName,
      record,
      index,
    );
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
    if (storedSchema === undefined) {
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
    return await MigrationManager.submitMigration(
      this.getCurrent().version,
      toVersion,
      updater,
      false,
      sync,
    );
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
