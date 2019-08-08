import {
  SchemaValidationError,
  TypedDataRecord,
  SchemaTypes,
  SchemaProcessingResult
} from "./schema-entities";
import vm from "vm";
import {
  SchemasDictionary,
  SchemaDefinition,
  FieldDefinition,
  ValueType,
  DataRecord,
  SchemaValidationErrorTypes
} from "./schema-entities";
import { loggerFor } from "../logger";
import {
  Checks,
  notEmpty,
  isEmptyString,
  isNotEmptyString,
  isAbsent,
  F,
  isNotAbsent
} from "../utils";
const L = loggerFor(__filename);

export const process = (
  dataSchema: SchemasDictionary,
  definition: string,
  records: ReadonlyArray<DataRecord>
): SchemaProcessingResult => {
  Checks.checkNotNull("records", records);
  Checks.checkNotNull("dataSchema", dataSchema);
  Checks.checkNotNull("definition", definition);

  const schemaDef: SchemaDefinition | undefined = dataSchema.schemas.find(
    e => e.name === definition
  );
  if (!schemaDef) {
    throw new Error(`no schema found for : ${definition}`);
  }

  let validationErrors: SchemaValidationError[] = [];
  const processedRecords: TypedDataRecord[] = [];

  records.forEach((rec, index) => {
    const defaultedRecord: DataRecord = populateDefaults(schemaDef, F(rec), index);
    L.debug(`done populating defaults for record #${index}`);
    const result = validate(schemaDef, defaultedRecord, index);
    L.debug(`done validation for record #${index}`);
    if (result && result.length > 0) {
      L.debug(`${result.length} validation errors for record #${index}`);
      validationErrors = validationErrors.concat(result);
      return;
    }
    const convertedRecord = convertFromRawStrings(schemaDef, defaultedRecord, index);
    L.debug(`converted row #${index} from raw strings`);
    const postTypeConversionValidationResult = validateAfterTypeConversion(
      schemaDef,
      convertedRecord,
      index
    );
    if (postTypeConversionValidationResult && postTypeConversionValidationResult.length > 0) {
      validationErrors = validationErrors.concat(postTypeConversionValidationResult);
      return;
    }
    processedRecords.push(convertedRecord);
  });
  L.debug(
    `done processing all rows, validationErrors: ${validationErrors.length}, validRecords: ${processedRecords.length}`
  );
  return F({
    validationErrors,
    processedRecords
  });
};

/**
 * Populate the passed records with the default value based on the field name if the field is
 * missing from the records it will be added.
 * @param definition the name of the schema definition to use for these records
 * @param records the list of records to populate with the default values.
 */
const populateDefaults = (
  schemaDef: Readonly<SchemaDefinition>,
  record: DataRecord,
  index: number
): DataRecord => {
  Checks.checkNotNull("records", record);
  L.debug(`in populateDefaults ${schemaDef.name}, ${record}`);
  const mutableRecord: RawMutableRecord = { ...record };
  const x: SchemaDefinition = schemaDef;
  schemaDef.fields.forEach(field => {
    if (!isNotAbsent(record[field.name]) && field.meta && field.meta.default) {
      L.debug(`populating Default: ${field.meta.default} for ${field.name} in record : ${record}`);
      mutableRecord[field.name] = `${field.meta.default}`;
    }
    return undefined;
  });
  return F(mutableRecord);
};

const convertFromRawStrings = (
  schemaDef: SchemaDefinition,
  record: DataRecord,
  index: number
): TypedDataRecord => {
  const mutableRecord: MutableRecord = { ...record };
  schemaDef.fields.forEach(field => {
    if (isNotEmptyString(record[field.name])) {
      return undefined;
    }

    const valueType = field.valueType;
    const rawValue = record[field.name];
    let typedValue: SchemaTypes = record[field.name];
    switch (valueType) {
      case ValueType.STRING:
        typedValue = record[field.name];
        break;
      case ValueType.INTEGER:
        typedValue = Number(rawValue);
        break;
      case ValueType.NUMBER:
        typedValue = Number(rawValue);
        break;
      case ValueType.BOOLEAN:
        typedValue = Boolean(rawValue);
        break;
    }
    mutableRecord[field.name] = typedValue;
  });
  return F(mutableRecord);
};
/**
 * Run schema validation pipeline for a schema defintion on the list of records provided.
 * @param definition the schema definition name.
 * @param record the records to validate.
 */
const validate = (
  schemaDef: SchemaDefinition,
  record: DataRecord,
  index: number
): ReadonlyArray<SchemaValidationError> => {
  const majorErrors = validation
    .runValidationPipeline(record, index, schemaDef.fields, [
      validation.validateRequiredFields,
      validation.validateValueTypes
    ])
    .filter(notEmpty);
  return [...majorErrors];
};

const validateAfterTypeConversion = (
  schemaDef: SchemaDefinition,
  record: TypedDataRecord,
  index: number
): ReadonlyArray<SchemaValidationError> => {
  const validationErrors = validation
    .runValidationPipeline(record, index, schemaDef.fields, [
      validation.validateRegex,
      validation.validateEnum,
      validation.validateScript
    ])
    .filter(notEmpty);

  return [...validationErrors];
};
export type ProcessingFunction = (
  schema: SchemaDefinition,
  rec: Readonly<DataRecord>,
  index: number
) => any;

type MutableRecord = { [key: string]: SchemaTypes };
type RawMutableRecord = { [key: string]: string };

namespace validation {
  // these validation functions run AFTER the record has been converted to the correct types from raw strings
  export type TypedValidationFunction = (
    rec: TypedDataRecord,
    index: number,
    fields: Array<FieldDefinition>
  ) => Array<SchemaValidationError>;

  // these validation functions run BEFORE the record has been converted to the correct types from raw strings
  export type ValidationFunction = (
    rec: DataRecord,
    index: number,
    fields: Array<FieldDefinition>
  ) => Array<SchemaValidationError>;

  export const runValidationPipeline = (
    rec: DataRecord | TypedDataRecord,
    index: number,
    fields: ReadonlyArray<FieldDefinition>,
    funs: Array<ValidationFunction | TypedValidationFunction>
  ) => {
    let result: Array<SchemaValidationError> = [];
    for (const fun of funs) {
      if (rec instanceof DataRecord) {
        const typedFunc = fun as ValidationFunction;
        result = result.concat(typedFunc(rec as DataRecord, index, getValidFields(result, fields)));
      } else {
        const typedFunc = fun as TypedValidationFunction;
        result = result.concat(
          typedFunc(rec as TypedDataRecord, index, getValidFields(result, fields))
        );
      }
    }
    return result;
  };

  export const validateRegex: TypedValidationFunction = (
    rec: TypedDataRecord,
    index: number,
    fields: ReadonlyArray<FieldDefinition>
  ) => {
    return fields
      .map(field => {
        const value = rec[field.name];
        if (typeof value !== "string") {
          return undefined;
        }

        if (
          field.restrictions &&
          field.restrictions.regex &&
          isInvalidRegexValue(field.restrictions.regex, value)
        ) {
          return buildError(SchemaValidationErrorTypes.INVALID_BY_REGEX, field.name, index);
        }
        return undefined;
      })
      .filter(notEmpty);
  };

  export const validateScript: TypedValidationFunction = (
    rec: TypedDataRecord,
    index: number,
    fields: Array<FieldDefinition>
  ) => {
    return fields
      .map(field => {
        if (field.restrictions && field.restrictions.script) {
          const scriptResult = validateWithScript(field, rec);
          if (!scriptResult.valid) {
            return buildError(SchemaValidationErrorTypes.INVALID_BY_SCRIPT, field.name, index, {
              message: scriptResult.message
            });
          }
        }
        return undefined;
      })
      .filter(notEmpty);
  };

  export const validateEnum: TypedValidationFunction = (
    rec: TypedDataRecord,
    index: number,
    fields: Array<FieldDefinition>
  ) => {
    return fields
      .map(field => {
        if (
          field.restrictions &&
          field.restrictions.codeList &&
          isInvalidEnumValue(field.restrictions.codeList, rec[field.name])
        ) {
          return buildError(SchemaValidationErrorTypes.INVALID_ENUM_VALUE, field.name, index);
        }
        return undefined;
      })
      .filter(notEmpty);
  };

  export const validateValueTypes: ValidationFunction = (
    rec: DataRecord,
    index: number,
    fields: Array<FieldDefinition>
  ) => {
    return fields
      .map(field => {
        if (rec[field.name] && isInvalidFieldType(field.valueType, rec[field.name])) {
          return buildError(SchemaValidationErrorTypes.INVALID_FIELD_VALUE_TYPE, field.name, index);
        }
        return undefined;
      })
      .filter(notEmpty);
  };

  export const validateRequiredFields = (
    rec: DataRecord,
    index: number,
    fields: Array<FieldDefinition>
  ) => {
    return fields
      .map(field => {
        if (isRequiredMissing(field, rec)) {
          return buildError(SchemaValidationErrorTypes.MISSING_REQUIRED_FIELD, field.name, index);
        }
        return undefined;
      })
      .filter(notEmpty);
  };

  export const getValidFields = (
    errs: ReadonlyArray<SchemaValidationError>,
    fields: ReadonlyArray<FieldDefinition>
  ) => {
    return fields.filter(field => {
      return !errs.find(e => e.fieldName == field.name);
    });
  };

  // return false if the record value is a valid type
  export const isInvalidFieldType = (valueType: ValueType, value: string) => {
    // optional field if the value is absent at this point
    if (isEmptyString(value)) return false;
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

  export const isRequiredMissing = (field: FieldDefinition, record: DataRecord) => {
    return field.restrictions && field.restrictions.required && isEmptyString(record[field.name]);
  };

  const isInvalidEnumValue = (
    codeList: Array<string | number>,
    value: string | boolean | number
  ) => {
    // optional field if the value is absent at this point
    if (isAbsent(value)) return false;
    return !codeList.find(e => e == value);
  };

  const isInvalidRegexValue = (regex: string, value: string) => {
    // optional field if the value is absent at this point
    if (isEmptyString(value)) return false;
    const regexPattern = new RegExp(regex);
    return !regexPattern.test(value);
  };

  const validateWithScript = (
    field: FieldDefinition,
    record: TypedDataRecord
  ): {
    valid: boolean;
    message: string;
  } => {
    try {
      const sandbox = {
        $row: record,
        $field: record[field.name]
      };

      if (!field.restrictions || !field.restrictions.script) {
        throw new Error("called validation by script without script provided");
      }

      const script = new vm.Script(field.restrictions.script);
      const ctx = vm.createContext(sandbox);
      const result = script.runInContext(ctx);
      return {
        valid: result.valid,
        message: result.message || ""
      };
    } catch (err) {
      console.error(`failed running validation script ${field.name} for record: ${record}`);
      return {
        valid: false,
        message: "failed to run script validation, check script and the input"
      };
    }
  };

  const buildError = (
    errorType: SchemaValidationErrorTypes,
    fieldName: string,
    index: number,
    info: object = {}
  ): SchemaValidationError => {
    return { errorType, fieldName, index, info };
  };
}
