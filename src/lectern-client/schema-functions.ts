import { SchemaValidationError, SchemaValidationErrors } from "./schema-entities";
import { DataSchema, SchemaDefinition, FieldDefinition, ValueType, DataRecord, ErrorTypes } from "./schema-entities";
import { loggerFor } from "../logger";
import { Errors, Checks } from "../utils";
const L = loggerFor(__filename);

/**
 * Populate the passed records with the default value based on the field name if the field is
 * missing from the records it will be added.
 * @param definition the name of the schema definition to use for these records
 * @param records the list of records to populate with the default values.
 */
export const populateDefaults = (dataSchema: DataSchema, definition: string, records: Array<DataRecord>) => {
    Checks.checkNotNull("records", records);
    Checks.checkNotNull("dataSchema", records);
    L.debug(`in populateDefaults ${definition}, ${records.length}`);
    const schemaDef: SchemaDefinition = dataSchema.definitions.find(e => e.name === definition);
    if (!schemaDef) {
        throw new Error(`no schema found for : ${definition}`);
    }
    records.forEach(rec => {
        schemaDef.fields.forEach(field => {
            if (validation.isAbsentOrEmpty(field, rec) && field.meta && field.meta.default) {
                L.debug(`populating Default: ${field.meta.default} for ${field.name} in record : ${rec}`);
                rec[field.name] = `${field.meta.default}`;
            }
            return undefined;
        });
    });

    return records;
};

/**
 * Run schema validation pipeline for a schema defintion on the list of records provided.
 * @param definition the schema definition name.
 * @param records the records to validate.
 */
export const validate = (dataSchema: DataSchema,
                         definition: string,
                         records: Array<DataRecord>): SchemaValidationErrors => {
    Checks.checkNotNull("records", records);
    Checks.checkNotNull("dataSchema", records);
    const schemaDef: SchemaDefinition = dataSchema.definitions.find(e => e.name === definition);
    if (!schemaDef) {
        throw new Error(`no schema found for : ${definition}`);
    }
    const errors: SchemaValidationErrors = {
        generalErrors: [],
        recordsErrors: []
    };
    const recordsErrors: Array<SchemaValidationError> = records.flatMap((rec, index) => {
        let errors: Array<SchemaValidationError> = [];
        errors = validation.runValidationPipeline(rec, index, schemaDef.fields, [
            validation.validateRequiredFields,
            validation.validateValueTypes,
            validation.validateRegex,
            // enum
            // script
        ]);
        return errors;
    }).filter(Boolean);

    errors.recordsErrors = recordsErrors;
    return errors;
};


namespace validation {

    export type ValidationFunction = (rec: DataRecord,
        index: number,
        fields: Array<FieldDefinition>) => Array<SchemaValidationError>;

    export const runValidationPipeline = (rec: DataRecord,
        index: number,
        fields: Array<FieldDefinition>,
        funs: Array<ValidationFunction>) => {

        let result: Array<SchemaValidationError> = [];
        for (const fun of funs) {
            result = result.concat(fun(rec, index, getValidFields(result, fields)));
        }
        return result;
    };

    export const validateRegex = (rec: DataRecord, index: number, fields: Array<FieldDefinition>) => {
        return fields.map(field => {
            if (field.restrictions
                && field.restrictions.regex
                && isValidRegexValue(field.restrictions.regex, rec[field.name])) {
                return buildError(ErrorTypes.INVALID_BY_REGEX, field.name, index);
            }
            return undefined;
        }).filter(Boolean);
    };

    export const validateValueTypes = (rec: DataRecord, index: number, fields: Array<FieldDefinition>) => {
        return fields.map(field => {
            if (isInvalidFieldType(field.valueType, rec[field.name])) {
                return buildError(ErrorTypes.INVALID_FIELD_VALUE_TYPE, field.name, index);
            }
            return undefined;
        }).filter(Boolean);
    };

    export const validateRequiredFields = (rec: DataRecord, index: number, fields: Array<FieldDefinition>) => {
        return fields.map(field => {
            if (isRequiredMissing(field, rec)) {
                return buildError(ErrorTypes.MISSING_REQUIRED_FIELD, field.name, index);
            }
            return undefined;
        }).filter(Boolean);
    };

    export const getValidFields = (errs: Array<SchemaValidationError>, fields: Array<FieldDefinition>) => {
        return fields.filter(field => {
            return !errs.find(e => e.fieldName != field.name);
        });
    };

    const buildError = (errorType: ErrorTypes, fieldName: string, index: number): SchemaValidationError => {
        return { errorType, fieldName, index };
    };

    const isValidRegexValue = (regex: string, value: string) => {
        const regexPattern = new RegExp(regex);
        regexPattern.compile();
        return regexPattern.test(value);
    };

    // return false if the record value is a valid type
    export const isInvalidFieldType = (valueType: ValueType, recordFieldValue: string) => {
        switch (valueType) {
            case ValueType.string:
                return false;
            case ValueType.integer:
                try {
                    parseInt(recordFieldValue);
                    return false;
                } catch (err) {
                    return true;
                }
            case ValueType.number:
                try {
                    new Number(recordFieldValue);
                    return false;
                } catch (err) {
                    return true;
                }
            case ValueType.boolean:
                return !(recordFieldValue.toLowerCase() === "true" || recordFieldValue.toLowerCase() === "false");
        }
    };

    export const isAbsentOrEmpty = (field: FieldDefinition, record: DataRecord) => {
        if (!record[field.name] || record[field.name].trim() === "") {
            return true;
        }
        return false;
    };

    export const isRequiredMissing = (field: FieldDefinition, record: DataRecord) => {
        if (field.meta && field.meta.required && isAbsentOrEmpty(field, record)) {
            return true;
        }
        return false;
    };
}