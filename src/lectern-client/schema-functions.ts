/*
 * Copyright (c)  2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import {
  SchemaValidationError,
  TypedDataRecord,
  SchemaTypes,
  SchemaProcessingResult,
  FieldNamesByPriorityMap,
  BatchProcessingResult,
  CodeListRestriction,
  RangeRestriction,
} from './schema-entities';
import vm from 'vm';
import {
  SchemasDictionary,
  SchemaDefinition,
  FieldDefinition,
  ValueType,
  DataRecord,
  SchemaValidationErrorTypes,
} from './schema-entities';

import {
  Checks,
  notEmpty,
  isEmptyString,
  isAbsent,
  F,
  isNotAbsent,
  isStringArray,
  isString,
  isEmpty,
  convertToArray,
  isNumberArray,
} from '../utils';
import schemaErrorMessage from './schema-error-messages';
import _ from 'lodash';
import { loggerFor } from '../logger';
import { DeepReadonly } from 'deep-freeze';
const L = loggerFor(__filename);

export const getSchemaFieldNamesWithPriority = (
  schema: SchemasDictionary,
  definition: string,
): FieldNamesByPriorityMap => {
  const schemaDef: SchemaDefinition | undefined = schema.schemas.find(
    schema => schema.name === definition,
  );
  if (!schemaDef) {
    throw new Error(`no schema found for : ${definition}`);
  }
  const fieldNamesMapped: FieldNamesByPriorityMap = { required: [], optional: [] };
  schemaDef.fields.forEach(field => {
    if (field.restrictions && field.restrictions.required) {
      fieldNamesMapped.required.push(field.name);
    } else {
      fieldNamesMapped.optional.push(field.name);
    }
  });
  return fieldNamesMapped;
};

export const processRecords = (
  dataSchema: SchemasDictionary,
  definition: string,
  records: ReadonlyArray<DataRecord>,
): BatchProcessingResult => {
  Checks.checkNotNull('records', records);
  Checks.checkNotNull('dataSchema', dataSchema);
  Checks.checkNotNull('definition', definition);

  const schemaDef: SchemaDefinition | undefined = dataSchema.schemas.find(
    e => e.name === definition,
  );
  if (!schemaDef) {
    throw new Error(`no schema found for : ${definition}`);
  }

  let validationErrors: SchemaValidationError[] = [];
  const processedRecords: TypedDataRecord[] = [];

  records.forEach((r, i) => {
    const result = process(dataSchema, definition, r, i);
    validationErrors = validationErrors.concat(result.validationErrors);
    processedRecords.push(_.cloneDeep(result.processedRecord) as TypedDataRecord);
  });

  L.debug(
    `done processing all rows, validationErrors: ${validationErrors.length}, validRecords: ${processedRecords.length}`,
  );

  return F({
    validationErrors,
    processedRecords,
  });
};

export const process = (
  dataSchema: SchemasDictionary,
  definition: string,
  rec: Readonly<DataRecord>,
  index: number,
): SchemaProcessingResult => {
  Checks.checkNotNull('records', rec);
  Checks.checkNotNull('dataSchema', dataSchema);
  Checks.checkNotNull('definition', definition);

  const schemaDef: SchemaDefinition | undefined = dataSchema.schemas.find(
    e => e.name === definition,
  );

  if (!schemaDef) {
    throw new Error(`no schema found for : ${definition}`);
  }

  let validationErrors: SchemaValidationError[] = [];

  const defaultedRecord: DataRecord = populateDefaults(schemaDef, F(rec), index);
  L.debug(`done populating defaults for record #${index}`);
  const result = validate(schemaDef, defaultedRecord, index);
  L.debug(`done validation for record #${index}`);
  if (result && result.length > 0) {
    L.debug(`${result.length} validation errors for record #${index}`);
    validationErrors = validationErrors.concat(result);
  }
  const convertedRecord = convertFromRawStrings(schemaDef, defaultedRecord, index, result);
  L.debug(`converted row #${index} from raw strings`);
  const postTypeConversionValidationResult = validateAfterTypeConversion(
    schemaDef,
    _.cloneDeep(convertedRecord) as DataRecord,
    index,
  );

  if (postTypeConversionValidationResult && postTypeConversionValidationResult.length > 0) {
    validationErrors = validationErrors.concat(postTypeConversionValidationResult);
  }

  L.debug(
    `done processing all rows, validationErrors: ${validationErrors.length}, validRecords: ${convertedRecord}`,
  );

  return F({
    validationErrors,
    processedRecord: convertedRecord,
  });
};

/**
 * Populate the passed records with the default value based on the field name if the field is
 * missing from the records it will NOT be added.
 * @param definition the name of the schema definition to use for these records
 * @param records the list of records to populate with the default values.
 */
const populateDefaults = (
  schemaDef: Readonly<SchemaDefinition>,
  record: DeepReadonly<DataRecord>,
  index: number,
): DataRecord => {
  Checks.checkNotNull('records', record);
  L.debug(`in populateDefaults ${schemaDef.name}, ${record}`);
  const mutableRecord: RawMutableRecord = _.cloneDeep(record) as RawMutableRecord;
  const x: SchemaDefinition = schemaDef;
  schemaDef.fields.forEach(field => {
    const defaultValue = field.meta && field.meta.default;
    if (isEmpty(defaultValue)) return undefined;

    const value = record[field.name];

    // data record  value is (or is expected to be) just one string
    if (isString(value) && !field.isArray) {
      if (isNotAbsent(value) && value.trim() === '') {
        L.debug(`populating Default: ${defaultValue} for ${field.name} in record : ${record}`);
        mutableRecord[field.name] = `${defaultValue}`;
      }
      return undefined;
    }

    // data record value is (or is expected to be) array of string
    if (isStringArray(value) && field.isArray) {
      if (notEmpty(value) && value.every(v => v.trim() === '')) {
        L.debug(`populating Default: ${defaultValue} for ${field.name} in record : ${record}`);
        const arrayDefaultValue = convertToArray(defaultValue);
        mutableRecord[field.name] = arrayDefaultValue.map(v => `${v}`);
      }
      return undefined;
    }
  });

  return _.cloneDeep(mutableRecord);
};

const convertFromRawStrings = (
  schemaDef: SchemaDefinition,
  record: DataRecord,
  index: number,
  recordErrors: ReadonlyArray<SchemaValidationError>,
): DeepReadonly<TypedDataRecord> => {
  const mutableRecord: MutableRecord = { ...record };
  schemaDef.fields.forEach(field => {
    // if there was an error for this field don't convert it. this means a string was passed instead of number or boolean
    // this allows us to continue other validations without hiding possible errors down.
    if (
      recordErrors.find(
        er =>
          er.errorType == SchemaValidationErrorTypes.INVALID_FIELD_VALUE_TYPE &&
          er.fieldName == field.name,
      )
    ) {
      return undefined;
    }

    /*
     * if the field is missing from the records don't set it to undefined
     */
    if (!_.has(record, field.name)) {
      return;
    }

    // need to check how it behaves for record[field.name] == ""
    if (isEmpty(record[field.name])) {
      mutableRecord[field.name] = undefined;
      return;
    }

    const valueType = field.valueType;
    const rawValue = record[field.name];

    if (field.isArray) {
      const rawValues = convertToArray(rawValue);
      mutableRecord[field.name] = rawValues.map(
        rv => getTypedValue(field, valueType, rv) as any, // fix type here
      );
    } else {
      mutableRecord[field.name] = getTypedValue(field, valueType, rawValue as string);
    }
  });
  return F(mutableRecord);
};

const getTypedValue = (field: FieldDefinition, valueType: ValueType, rawValue: string) => {
  let formattedFieldValue = rawValue;
  // convert field to match corresponding enum from codelist, if possible
  if (field.restrictions && field.restrictions.codeList && valueType === ValueType.STRING) {
    const formattedField = field.restrictions.codeList.find(
      e => e.toString().toLowerCase() === rawValue.toString().toLowerCase(),
    );
    if (formattedField) {
      formattedFieldValue = formattedField as string;
    }
  }

  let typedValue: SchemaTypes = rawValue;
  switch (valueType) {
    case ValueType.STRING:
      typedValue = formattedFieldValue;
      break;
    case ValueType.INTEGER:
      typedValue = Number(rawValue);
      break;
    case ValueType.NUMBER:
      typedValue = Number(rawValue);
      break;
    case ValueType.BOOLEAN:
      // we have to lower case in case of inconsistent letters (boolean requires all small letters).
      typedValue = Boolean(rawValue.toLowerCase());
      break;
  }

  return typedValue;
};

/**
 * Run schema validation pipeline for a schema defintion on the list of records provided.
 * @param definition the schema definition name.
 * @param record the records to validate.
 */
const validate = (
  schemaDef: SchemaDefinition,
  record: DataRecord,
  index: number,
): ReadonlyArray<SchemaValidationError> => {
  const majorErrors = validation
    .runValidationPipeline(record, index, schemaDef.fields, [
      validation.validateFieldNames,
      validation.validateNonArrayFields,
      validation.validateRequiredFields,
      validation.validateValueTypes,
    ])
    .filter(notEmpty);
  return [...majorErrors];
};

const validateAfterTypeConversion = (
  schemaDef: SchemaDefinition,
  record: TypedDataRecord,
  index: number,
): ReadonlyArray<SchemaValidationError> => {
  const validationErrors = validation
    .runValidationPipeline(record, index, schemaDef.fields, [
      validation.validateRegex,
      validation.validateRange,
      validation.validateEnum,
      validation.validateScript,
    ])
    .filter(notEmpty);

  return [...validationErrors];
};
export type ProcessingFunction = (
  schema: SchemaDefinition,
  rec: Readonly<DataRecord>,
  index: number,
) => any;

type MutableRecord = { [key: string]: SchemaTypes };
type RawMutableRecord = { [key: string]: string | string[] };

namespace validation {
  // these validation functions run AFTER the record has been converted to the correct types from raw strings
  export type TypedValidationFunction = (
    rec: TypedDataRecord,
    index: number,
    fields: Array<FieldDefinition>,
  ) => Array<SchemaValidationError>;

  // these validation functions run BEFORE the record has been converted to the correct types from raw strings
  export type ValidationFunction = (
    rec: DataRecord,
    index: number,
    fields: Array<FieldDefinition>,
  ) => Array<SchemaValidationError>;

  export const runValidationPipeline = (
    rec: DataRecord | TypedDataRecord,
    index: number,
    fields: ReadonlyArray<FieldDefinition>,
    funs: Array<ValidationFunction | TypedValidationFunction>,
  ) => {
    let result: Array<SchemaValidationError> = [];
    for (const fun of funs) {
      if (rec instanceof DataRecord) {
        const typedFunc = fun as ValidationFunction;
        result = result.concat(typedFunc(rec as DataRecord, index, getValidFields(result, fields)));
      } else {
        const typedFunc = fun as TypedValidationFunction;
        result = result.concat(
          typedFunc(rec as TypedDataRecord, index, getValidFields(result, fields)),
        );
      }
    }
    return result;
  };

  export const validateRegex: TypedValidationFunction = (
    rec: TypedDataRecord,
    index: number,
    fields: ReadonlyArray<FieldDefinition>,
  ) => {
    return fields
      .map(field => {
        const recordFieldValues = convertToArray(rec[field.name]);
        if (!isStringArray(recordFieldValues)) return undefined;

        const regex = field.restrictions?.regex;
        if (isEmpty(regex)) return undefined;

        const invalidValues = recordFieldValues.filter(v => isInvalidRegexValue(regex, v));
        if (invalidValues.length !== 0) {
          const examples = field.meta?.examples;
          const info = field.isArray
            ? { value: invalidValues, regex, examples }
            : { regex, examples };
          return buildError(SchemaValidationErrorTypes.INVALID_BY_REGEX, field.name, index, info);
        }
        return undefined;
      })
      .filter(notEmpty);
  };

  export const validateRange: TypedValidationFunction = (
    rec: TypedDataRecord,
    index: number,
    fields: ReadonlyArray<FieldDefinition>,
  ) => {
    return fields
      .map(field => {
        const recordFieldValues = convertToArray(rec[field.name]);
        if (!isNumberArray(recordFieldValues)) return undefined;

        const range = field.restrictions?.range;
        if (isEmpty(range)) return undefined;

        const invalidValues = recordFieldValues.filter(v => isOutOfRange(range, v));
        if (invalidValues.length !== 0) {
          const info = field.isArray ? { value: invalidValues } : undefined;
          return buildError(SchemaValidationErrorTypes.INVALID_BY_RANGE, field.name, index, info);
        }
        return undefined;
      })
      .filter(notEmpty);
  };

  export const validateScript: TypedValidationFunction = (
    rec: TypedDataRecord,
    index: number,
    fields: Array<FieldDefinition>,
  ) => {
    return fields
      .map(field => {
        if (field.restrictions && field.restrictions.script) {
          const scriptResult = validateWithScript(field, rec);
          if (!scriptResult.valid) {
            return buildError(SchemaValidationErrorTypes.INVALID_BY_SCRIPT, field.name, index, {
              message: scriptResult.message,
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
    fields: Array<FieldDefinition>,
  ) => {
    return fields
      .map(field => {
        const codeList = field.restrictions?.codeList || undefined;
        if (isEmpty(codeList)) return undefined;

        const recordFieldValues = convertToArray(rec[field.name]); // put all values into array for easier validation
        const invalidValues = recordFieldValues.filter(val => isInvalidEnumValue(codeList, val));

        if (invalidValues.length !== 0) {
          const info = field.isArray ? { value: invalidValues } : undefined;
          return buildError(SchemaValidationErrorTypes.INVALID_ENUM_VALUE, field.name, index, info);
        }
        return undefined;
      })
      .filter(notEmpty);
  };

  export const validateValueTypes: ValidationFunction = (
    rec: DataRecord,
    index: number,
    fields: Array<FieldDefinition>,
  ) => {
    return fields
      .map(field => {
        if (isEmpty(rec[field.name])) return undefined;

        const recordFieldValues = convertToArray(rec[field.name]); // put all values into array
        const invalidValues = recordFieldValues.filter(v => isInvalidFieldType(field.valueType, v));

        if (invalidValues.length !== 0) {
          return buildError(SchemaValidationErrorTypes.INVALID_FIELD_VALUE_TYPE, field.name, index);
        }
        return undefined;
      })
      .filter(notEmpty);
  };

  export const validateRequiredFields = (
    rec: DataRecord,
    index: number,
    fields: Array<FieldDefinition>,
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

  export const validateFieldNames: ValidationFunction = (
    record: Readonly<DataRecord>,
    index: number,
    fields: Array<FieldDefinition>,
  ) => {
    const expectedFields = new Set(fields.map(field => field.name));
    return Object.keys(record)
      .map(recFieldName => {
        if (!expectedFields.has(recFieldName)) {
          return buildError(SchemaValidationErrorTypes.UNRECOGNIZED_FIELD, recFieldName, index);
        }
        return undefined;
      })
      .filter(notEmpty);
  };

  export const validateNonArrayFields: ValidationFunction = (
    record: Readonly<DataRecord>,
    index: number,
    fields: Array<FieldDefinition>,
  ) => {
    return fields
      .map(field => {
        if (!field.isArray && isStringArray(record[field.name])) {
          return buildError(SchemaValidationErrorTypes.INVALID_FIELD_VALUE_TYPE, field.name, index);
        }
        return undefined;
      })
      .filter(notEmpty);
  };

  export const getValidFields = (
    errs: ReadonlyArray<SchemaValidationError>,
    fields: ReadonlyArray<FieldDefinition>,
  ) => {
    return fields.filter(field => {
      return !errs.find(e => e.fieldName == field.name);
    });
  };

  // return false if the record value is a valid type
  export const isInvalidFieldType = (valueType: ValueType, value: string) => {
    // optional field if the value is absent at this point
    if (isAbsent(value) || isEmptyString(value)) return false;
    switch (valueType) {
      case ValueType.STRING:
        return false;
      case ValueType.INTEGER:
        return isNaN(Number(value)) || !Number.isInteger(Number(value));
      case ValueType.NUMBER:
        return isNaN(Number(value));
      case ValueType.BOOLEAN:
        return !(value.toLowerCase() === 'true' || value.toLowerCase() === 'false');
    }
  };

  export const isRequiredMissing = (field: FieldDefinition, record: DataRecord) => {
    const isRequired = field.restrictions && field.restrictions.required;
    if (!isRequired) return false;

    const recordFieldValues = convertToArray(record[field.name]);
    return recordFieldValues.every(isEmptyString);
  };

  const isOutOfRange = (range: RangeRestriction, value: number | undefined) => {
    if (value == undefined) return false;
    const invalidRange =
      // less than the min if defined ?
      (range.min !== undefined && value < range.min) ||
      (range.exclusiveMin !== undefined && value <= range.exclusiveMin) ||
      // bigger than max if defined ?
      (range.max !== undefined && value > range.max) ||
      (range.exclusiveMax !== undefined && value >= range.exclusiveMax);
    return invalidRange;
  };

  const isInvalidEnumValue = (
    codeList: CodeListRestriction,
    value: string | boolean | number | undefined,
  ) => {
    // optional field if the value is absent at this point
    if (isAbsent(value) || isEmptyString(value as string)) return false;
    return !codeList.find(e => e === value);
  };

  const isInvalidRegexValue = (regex: string, value: string) => {
    // optional field if the value is absent at this point
    if (isAbsent(value) || isEmptyString(value)) return false;
    const regexPattern = new RegExp(regex);
    return !regexPattern.test(value);
  };

  const validateWithScript = (
    field: FieldDefinition,
    record: TypedDataRecord,
  ): {
    valid: boolean;
    message: string;
  } => {
    try {
      const sandbox = {
        $row: record,
        $field: record[field.name],
        $name: field.name,
      };

      if (!field.restrictions || !field.restrictions.script) {
        throw new Error('called validation by script without script provided');
      }

      // scripts should already be strings inside arrays, but ensure that they are to help transition between lectern versions
      // checking for this can be removed in future versions of lectern (feb 2020)
      const scripts =
        typeof field.restrictions.script === 'string'
          ? [field.restrictions.script]
          : field.restrictions.script;

      const ctx = vm.createContext(sandbox);

      let result: {
        valid: boolean;
        message: string;
      } = {
        valid: false,
        message: '',
      };

      for (const scriptString of scripts) {
        const script = new vm.Script(scriptString);
        result = script.runInContext(ctx);
        /* Return the first script that's invalid. Otherwise result will be valid with message: 'ok'*/
        if (!result.valid) break;
      }

      return result;
    } catch (err) {
      console.error(
        `failed running validation script ${field.name} for record: ${JSON.stringify(
          record,
        )}. Error message: ${err}`,
      );
      return {
        valid: false,
        message: 'failed to run script validation, check script and the input',
      };
    }
  };

  const buildError = (
    errorType: SchemaValidationErrorTypes,
    fieldName: string,
    index: number,
    info: object = {},
  ): SchemaValidationError => {
    const errorData = { errorType, fieldName, index, info };
    return { ...errorData, message: schemaErrorMessage(errorType, errorData) };
  };
}
