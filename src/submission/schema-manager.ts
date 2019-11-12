import * as service from '../lectern-client/schema-functions';
import {
  SchemasDictionary,
  DataRecord,
  SchemaProcessingResult,
  FieldNamesByPriorityMap,
  SchemaDefinition,
} from '../lectern-client/schema-entities';
import * as changeAnalyzer from '../lectern-client/change-analyzer';
import { schemaClient as schemaServiceAdapter } from '../lectern-client/schema-rest-client';
import { schemaRepo } from './schema-repo';
import { loggerFor } from '../logger';
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
    const result = await changeAnalyzer.analyzeChanges(
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
