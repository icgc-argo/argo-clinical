import { SchemaValidationError } from "./submission";
import { DataSchema } from "../entities/submission";
import { schemaRepo } from "../../adapters/repository/submission/dataschemaRepo";
import { fetchSchema } from "../../adapters/schema-client";

export let schema: DataSchema;

export const validate = (fileName: string, records: Array<any>): SchemaValidationError => {
    return {
        generalErrors: [],
        recordsErrors: []
    };
};

export const updateVersion = async (newVersion: string): Promise<DataSchema> => {
    const newSchema = await fetchSchema(newVersion);
    await schemaRepo.update(newSchema);
    return newSchema;
};

export const loadSchema = async (): Promise<DataSchema> => {
    // tbd: should check locally or fall back to the dictionary service to load the specifed version
    schema = await schemaRepo.get();
    if (!schema.definitions || schema.definitions.length == 0) {
        const result = await fetchSchema(schema.version);
        schema.definitions = result.definitions;
    }
    return schema;
};

