import { SchemaValidationError } from "./submission";
import { DataSchema } from "../entities/submission";
import { schemaRepo } from "../../adapters/repository/submission/dataschemaRepo";
import { fetchSchema } from "../../adapters/schema-client";
import { loggerFor } from "../../logger";
const L = loggerFor(__filename);

export let schema: DataSchema;

export const validate = (definition: string, records: Array<any>): SchemaValidationError => {

    return {
        generalErrors: [],
        recordsErrors: []
    };
};

export const getCurrent = async (): Promise<DataSchema> => {
    return schema;
};

export const updateVersion = async (newVersion: string): Promise<DataSchema> => {
    const newSchema = await fetchSchema(newVersion);
    return await schemaRepo.createOrUpdate(newSchema);
};

export const loadSchema = async (initialVersion: string): Promise<DataSchema> => {
    L.debug(`in loadSchema ${initialVersion}`);
    if (!initialVersion) {
        throw new Error("initial version cannot be empty");
    }
    schema = await schemaRepo.get();
    if (!schema) {
        L.info(`schema not found in db`);
        schema = {
            definitions: [],
            version: initialVersion
        };
    }

    // if the schema is not complete we need to load it from the
    // schema service (lectern)
    if (!schema.definitions || schema.definitions.length == 0) {
        L.debug(`fetching schema from schema service`);
        const result = await fetchSchema(schema.version);
        L.info(`fetched schema ${result.version}`);
        schema.definitions = result.definitions;
        return await schemaRepo.createOrUpdate(schema);
    }
    return schema;
};

