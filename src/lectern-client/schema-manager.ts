import * as service from "./schema-functions";
import { DataSchema, DataRecord, SchemaValidationErrors } from "./schema-entities";
import { schemaClient as schemaServiceAdapter } from "./schema-rest-client";
import { schemaRepo } from "./schema-repo";
import { loggerFor } from "../logger";
const L = loggerFor(__filename);

export let schema: DataSchema;

export const getCurrent = (): DataSchema => {
  return schema;
};

export const updateVersion = async (name: string, newVersion: string): Promise<DataSchema> => {
  const newSchema = await schemaServiceAdapter.fetchSchema(name, newVersion);
  const result = await schemaRepo.createOrUpdate(newSchema);
  schema = result;
  return schema;
};

export const loadSchema = async (name: string, initialVersion: string): Promise<DataSchema> => {
  L.debug(`in loadSchema ${initialVersion}`);
  if (!initialVersion) {
    throw new Error("initial version cannot be empty");
  }
  schema = await schemaRepo.get(name);
  if (!schema) {
    L.info(`schema not found in db`);
    schema = {
      definitions: [],
      name: name,
      version: initialVersion
    };
  }

  // if the schema is not complete we need to load it from the
  // schema service (lectern)
  if (!schema.definitions || schema.definitions.length == 0) {
    L.debug(`fetching schema from schema service`);
    const result = await schemaServiceAdapter.fetchSchema(name, schema.version);
    L.info(`fetched schema ${result.version}`);
    schema.definitions = result.definitions;
    return await schemaRepo.createOrUpdate(schema);
  }
  return schema;
};

export const populateDefaults = (definition: string, records: Array<DataRecord>) => {
  return service.populateDefaults(getCurrent(), definition, records);
};

export const validate = (
  definition: string,
  records: Array<DataRecord>
): SchemaValidationErrors => {
  L.debug(`in validate ${definition}`);
  return service.validate(getCurrent(), definition, records);
};
