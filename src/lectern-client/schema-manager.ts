import * as service from "./schema-functions";
import { SchemasDictionary, DataRecord, SchemaValidationErrors } from "./schema-entities";
import { schemaClient as schemaServiceAdapter } from "./schema-rest-client";
import { schemaRepo } from "./schema-repo";
import { loggerFor } from "../logger";
const L = loggerFor(__filename);

export let schema: SchemasDictionary;

export const getCurrent = (): SchemasDictionary => {
  return schema;
};
/**
 * This method does three things:
 * 1- populate default values for missing fields
 * 2- validate the record against the schema
 * 3- convert the raw data from strings to their proper type if needed.
 *
 * @param definition the schema we want to process records for
 * @param records the raw records list
 *
 * @returns object contains the validation errors and the valid processed records.
 */
export const process = (definition: string, records: ReadonlyArray<DataRecord>) => {
  return service.process(getCurrent(), definition, records);
};

export const updateVersion = async (
  name: string,
  newVersion: string
): Promise<SchemasDictionary> => {
  const newSchema = await schemaServiceAdapter.fetchSchema(name, newVersion);
  const result = await schemaRepo.createOrUpdate(newSchema);
  if (!result) {
    throw new Error("couldn't save/update new schema");
  }
  schema = result;
  return schema;
};

export const loadSchema = async (
  name: string,
  initialVersion: string
): Promise<SchemasDictionary> => {
  L.debug(`in loadSchema ${initialVersion}`);
  if (!initialVersion) {
    throw new Error("initial version cannot be empty");
  }
  const storedSchema = await schemaRepo.get(name);
  if (storedSchema === null) {
    L.info(`schema not found in db`);
    schema = {
      schemas: [],
      name: name,
      version: initialVersion
    };
  } else {
    schema = storedSchema;
  }

  // if the schema is not complete we need to load it from the
  // schema service (lectern)
  if (!schema.schemas || schema.schemas.length == 0) {
    L.debug(`fetching schema from schema service`);
    const result = await schemaServiceAdapter.fetchSchema(name, schema.version);
    L.info(`fetched schema ${result.version}`);
    schema.schemas = result.schemas;
    const saved = await schemaRepo.createOrUpdate(schema);
    if (!saved) {
      throw new Error("couldn't save/update new schema");
    }
    return saved;
  }
  return schema;
};
