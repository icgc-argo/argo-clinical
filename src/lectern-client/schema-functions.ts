import { SchemaValidationError, SchemaValidationErrors } from "./schema-entities";
import vm from "vm";
import {
  DataSchema,
  SchemaDefinition,
  FieldDefinition,
  ValueType,
  DataRecord,
  ErrorTypes
} from "./schema-entities";
import { loggerFor } from "../logger";
import { Errors, Checks } from "../utils";
const L = loggerFor(__filename);

/**
 * Populate the passed records with the default value based on the field name if the field is
 * missing from the records it will be added.
 * @param definition the name of the schema definition to use for these records
 * @param records the list of records to populate with the default values.
 */
export const populateDefaults = (
  dataSchema: DataSchema,
  definition: string,
  records: Array<DataRecord>
) => {
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
export const validate = (
  dataSchema: DataSchema,
  definition: string,
  records: Array<DataRecord>
): SchemaValidationErrors => {
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
  const recordsErrors: Array<SchemaValidationError> = records
    .flatMap((rec, index) => {
      let errors: Array<SchemaValidationError> = [];
      errors = validation.runValidationPipeline(rec, index, schemaDef.fields, [
        validation.validateRequiredFields,
        validation.validateValueTypes,
        validation.validateRegex,
        validation.validateEnum,
        validation.validateScript
      ]);
      return errors;
    })
    .filter(Boolean);

  errors.recordsErrors = recordsErrors;
  return errors;
};

namespace validation {
  export type ValidationFunction = (
    rec: DataRecord,
    index: number,
    fields: Array<FieldDefinition>
  ) => Array<SchemaValidationError>;

  export const runValidationPipeline = (
    rec: DataRecord,
    index: number,
    fields: Array<FieldDefinition>,
    funs: Array<ValidationFunction>
  ) => {
    let result: Array<SchemaValidationError> = [];
    for (const fun of funs) {
      result = result.concat(fun(rec, index, getValidFields(result, fields)));
    }
    return result;
  };

  export const validateRegex = (rec: DataRecord, index: number, fields: Array<FieldDefinition>) => {
    return fields
      .map(field => {
        if (
          field.restrictions &&
          field.restrictions.regex &&
          isInvalidRegexValue(field.restrictions.regex, rec[field.name])
        ) {
          return buildError(ErrorTypes.INVALID_BY_REGEX, field.name, index);
        }
        return undefined;
      })
      .filter(Boolean);
  };

  export const validateScript = (
    rec: DataRecord,
    index: number,
    fields: Array<FieldDefinition>
  ) => {
    return fields
      .map(field => {
        if (field.restrictions && field.restrictions.script && isInvalidByScript(field, rec)) {
          return buildError(ErrorTypes.INVALID_BY_SCRIPT, field.name, index);
        }
        return undefined;
      })
      .filter(Boolean);
  };

  export const validateEnum = (rec: DataRecord, index: number, fields: Array<FieldDefinition>) => {
    return fields
      .map(field => {
        if (
          field.restrictions &&
          field.restrictions.codeList &&
          isInvalidEnumValue(field.restrictions.codeList, rec[field.name])
        ) {
          return buildError(ErrorTypes.INVALID_ENUM_VALUE, field.name, index);
        }
        return undefined;
      })
      .filter(Boolean);
  };

  export const validateValueTypes = (
    rec: DataRecord,
    index: number,
    fields: Array<FieldDefinition>
  ) => {
    return fields
      .map(field => {
        if (rec[field.name] && isInvalidFieldType(field.valueType, rec[field.name])) {
          return buildError(ErrorTypes.INVALID_FIELD_VALUE_TYPE, field.name, index);
        }
        return undefined;
      })
      .filter(Boolean);
  };

  export const validateRequiredFields = (
    rec: DataRecord,
    index: number,
    fields: Array<FieldDefinition>
  ) => {
    return fields
      .map(field => {
        if (isRequiredMissing(field, rec)) {
          return buildError(ErrorTypes.MISSING_REQUIRED_FIELD, field.name, index);
        }
        return undefined;
      })
      .filter(Boolean);
  };

  export const getValidFields = (
    errs: Array<SchemaValidationError>,
    fields: Array<FieldDefinition>
  ) => {
    return fields.filter(field => {
      return !errs.find(e => e.fieldName != field.name);
    });
  };

  // return false if the record value is a valid type
  export const isInvalidFieldType = (valueType: ValueType, value: string) => {
    if (!isNotEmptyString(value)) return false;
    switch (valueType) {
      case ValueType.STRING:
        return false;
      case ValueType.INTEGER:
        return Number(value) == NaN || !Number.isInteger(Number(value));
      case ValueType.NUMBER:
        return Number(value) == NaN;
      case ValueType.BOOLEAN:
        return !(value.toLowerCase() === "true" || value.toLowerCase() === "false");
    }
  };

  export const isAbsentOrEmpty = (field: FieldDefinition, record: DataRecord) => {
    return !isNotEmptyString(record[field.name]);
  };

  export const isRequiredMissing = (field: FieldDefinition, record: DataRecord) => {
    if (field.restrictions && field.restrictions.required && isAbsentOrEmpty(field, record)) {
      return true;
    }
    return false;
  };

  const isInvalidEnumValue = (codeList: Array<string | number>, value: string) => {
    if (!isNotEmptyString(value)) return false;
    return !codeList.find(e => e == value);
  };

  const isInvalidRegexValue = (regex: string, value: string) => {
    if (!isNotEmptyString(value)) return false;
    const regexPattern = new RegExp(regex);
    return !regexPattern.test(value);
  };

  const isInvalidByScript = (field: FieldDefinition, record: DataRecord) => {
    try {
      const sandbox = {
        $row: record,
        $field: record[field.name]
      };
      const script = new vm.Script(field.restrictions.script);
      const ctx = vm.createContext(sandbox);
      const result = script.runInContext(ctx);
      return !result.valid;
    } catch (err) {
      console.error(`failed running validation script ${field.name} for record: ${record}`);
      return true;
    }
  };

  const isNotEmptyString = (value: string) => {
    return value !== null && value !== undefined && value.trim() !== "";
  };

  const buildError = (
    errorType: ErrorTypes,
    fieldName: string,
    index: number
  ): SchemaValidationError => {
    return { errorType, fieldName, index };
  };
}
