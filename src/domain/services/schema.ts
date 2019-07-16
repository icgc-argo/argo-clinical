import { SchemaValidationError, SchemaValidationErrors } from "./submission";
import { DataSchema, SchemaDefinition, FieldDefinition, ValueType,  } from "../entities/submission";
import { schemaRepo } from "../../adapters/repository/submission/dataschema-repo";
import { schemaClient as schemaServiceAdapter } from "../../adapters/schema-service-client";
import { loggerFor } from "../../logger";
const L = loggerFor(__filename);
export let schema: DataSchema;

export const validate = (definition: string, records: Array<Record>): SchemaValidationErrors => {
    const schemaDef: SchemaDefinition = schema.definitions.find(e => e.name === definition);
    if (!schemaDef) {
        throw new Error(`no schema found for : ${definition}`);
    }
    const errors: SchemaValidationErrors = {
        generalErrors: [],
        recordsErrors: []
    };
    const recordsErrors: Array<SchemaValidationError> = records.flatMap((rec, index) => {
        let errors: Array<SchemaValidationError> = [];
        errors = runValidationPipeline(rec, index, schemaDef.fields, [
            getRecordsMissingFieldsErrors,
            getInvalidTypeValuesErrors
        ]);
        return errors;
    }).filter(Boolean);

    errors.recordsErrors = recordsErrors;
    return errors;
};

type ValidationFunction = (rec: Record, index: number, fields: Array<FieldDefinition>) => Array<SchemaValidationError>;
const runValidationPipeline = (rec: Record,
    index: number,
    fields: Array<FieldDefinition>,
    funs: Array<ValidationFunction>) => {

    let result: Array<SchemaValidationError> = [];
    for (const fun of funs) {
        result = result.concat(fun(rec, index, getHealthyFields(result, fields)));
    }
    return result;
};

const getHealthyFields = (errs: Array<SchemaValidationError>, fields: Array<FieldDefinition>) => {
    return fields.filter(field => {
        return !errs.find(e => e.fieldName != field.name);
    });
};

const getInvalidTypeValuesErrors = (rec: Record, index: number, fields: Array<FieldDefinition>) => {
    return fields.map(field => {
        if (isInvalidFieldType(field.valueType, rec[field.name])) {
            const err: SchemaValidationError =  {errorType: "INVALID_FIELD_VALUE_TYPE", fieldName: field.name, index: index};
            return err;
        }
    }).filter(e => e);
};

const getRecordsMissingFieldsErrors = (rec: Record, index: number, fields: Array<FieldDefinition>) => {
    return fields.map(field => {
        if (isRequiredMissing(field, rec)) {
            const err: SchemaValidationError = {errorType: "MISSING_REQUIRED_FIELD", fieldName: field.name, index: index};
            return err;
        }
        return undefined;
    }).filter(e => e);
};

const isInvalidFieldType = (valueType: ValueType, recordFieldValue: string) => {
    if (valueType == ValueType.string) {
        return true;
    }
    if (valueType == ValueType.integer) {
        try {
            parseInt(recordFieldValue);
            return true;
        } catch (err) {
            return false;
        }
    }
    return false;
};

const isRequiredMissing = (field: FieldDefinition, record: Record) => {
    if (!record[field.name] && field.meta && field.meta.required) {
        return true;
    }
    return false;
};


export const getCurrent = async (): Promise<DataSchema> => {
    return schema;
};

export const updateVersion = async (newVersion: string): Promise<DataSchema> => {
    const newSchema = await schemaServiceAdapter.fetchSchema(newVersion);
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
        const result = await schemaServiceAdapter.fetchSchema(schema.version);
        L.info(`fetched schema ${result.version}`);
        schema.definitions = result.definitions;
        return await schemaRepo.createOrUpdate(schema);
    }
    return schema;
};

export interface Record {
    [k: string]: string;
}