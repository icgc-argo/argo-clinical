/*
 * Copyright (c) 2023 The Ontario Institute for Cancer Research. All rights reserved
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

import { isEqual } from 'lodash';
import * as dictionaryManager from '../dictionary/manager';
import { SchemaWithFields } from '../dictionary/manager';
import { loggerFor } from '../logger';
import { ExceptionRecord, ExceptionValue, ObjectValues, ProgramExceptionRecord } from './types';

const L = loggerFor(__filename);

type ValidationResult = {
  message: string;
  result: ValidationResultErrorType;
};

export const ValidationResultType = {
  VALID: 'VALID',
  INVALID: 'INVALID',
  EMPTY_FIELD: 'EMPTY_FIELD',
  TYPE_ERROR: 'TYPE_ERROR',
  UNDEFINED: 'UNDEFINED',
  PARAM_INVALID: 'INVALID_PARAM',
} as const;

type ValidationResultErrorType = ObjectValues<typeof ValidationResultType>;

export type ValidationError = {
  field: string;
  recordIndex: number;
} & ValidationResult;

const createValidationError = ({
  recordIndex,
  result,
  message,
  field,
}: {
  field: string;
  result: ValidationResultErrorType;
  message: string;
  recordIndex: number;
}): ValidationError => ({
  recordIndex: recordIndex + 1, // account for tsv header row
  field,
  result,
  message,
});

export type Validator<RecordT extends Object> = {
  ({
    fieldValue,
    fieldName,
    recordIndex,
    record,
    programId,
  }: {
    fieldValue: any;
    fieldName: string;
    recordIndex: number;
    record: RecordT;
    programId: string;
  }): Promise<ValidationResult> | ValidationResult;
};

export type FieldValidators<RecordT extends Object> = Partial<
  {
    [key in keyof RecordT]: Validator<RecordT>;
  }
>;

export const checkCoreField: Validator<ExceptionRecord> = async ({ record, fieldName }) => {
  const currentDictionary = await dictionaryManager.instance();

  const requestedCoreField = record.requested_core_field;

  if (requestedCoreField === undefined) {
    return {
      result: ValidationResultType.UNDEFINED,
      message: `'${fieldName}' value is not defined`,
    };
  }

  const fieldFilter = (field: { name: string; meta?: { core: boolean } }): boolean => {
    return field.name === requestedCoreField && !!field.meta?.core;
  };

  const schemaFilter = (schema: SchemaWithFields): boolean => {
    return schema.name === record.schema;
  };

  const existingDictionarySchema = await currentDictionary.getSchemasWithFields(
    schemaFilter,
    fieldFilter,
  );

  const isValid = existingDictionarySchema[0] && existingDictionarySchema[0].fields.length > 0;
  return {
    result: isValid ? ValidationResultType.VALID : ValidationResultType.INVALID,
    message: isValid
      ? ''
      : `The requested_core_field '${record.requested_core_field}' does not match schema '${record.schema}'. Please update your exception request form.`,
  };
};

export const checkProgramId: Validator<ProgramExceptionRecord> = ({
  record,
  programId,
  fieldName,
}) => {
  const result =
    programId === record.program_name
      ? ValidationResultType.VALID
      : ValidationResultType.PARAM_INVALID;

  const message =
    result !== ValidationResultType.VALID
      ? `Submitted exception '${fieldName}' of '${record.program_name}' does not match request parameter program id of '${programId}'`
      : '';
  return { result, message };
};

export const checkRequestedValue: Validator<ExceptionRecord> = ({ record, fieldName }) => {
  const validRequests: string[] = Object.values(ExceptionValue);
  const requestedExceptionValue = record.requested_exception_value;

  if (requestedExceptionValue === undefined) {
    return {
      result: ValidationResultType.UNDEFINED,
      message: `${fieldName} value is not defined`,
    };
  } else if (typeof requestedExceptionValue !== 'string') {
    return {
      result: ValidationResultType.TYPE_ERROR,
      message: `${fieldName} value is not a string`,
    };
  } else if (!validRequests.includes(requestedExceptionValue)) {
    return {
      result: ValidationResultType.INVALID,
      message: `'${fieldName}' value is not valid. Must be one of [${validRequests.join(', ')}]`,
    };
  } else {
    return { result: ValidationResultType.VALID, message: '' };
  }
};

export const checkForEmptyField: Validator<ExceptionRecord> = ({
  fieldValue,
  fieldName,
}): ValidationResult => {
  const isValid = fieldValue !== '' || !!fieldValue;
  const errorMessage = `${fieldName} cannot be empty`;

  return {
    result: isValid ? ValidationResultType.VALID : ValidationResultType.EMPTY_FIELD,
    message: isValid ? '' : errorMessage,
  };
};

/**
 * checks if schema is valid dictionary schema
 * does not check if schema is valid to rest of record
 */
export const checkIsValidDictionarySchema: Validator<ExceptionRecord> = async ({ fieldValue }) => {
  const errorMessage = 'field is empty';
  if (!fieldValue) {
    return {
      result: ValidationResultType.EMPTY_FIELD,
      message: errorMessage,
    };
  }

  const currentDictionary = await dictionaryManager.instance();

  const schemaFilter = (schema: SchemaWithFields): boolean => {
    return schema.name === fieldValue;
  };

  const existingDictionarySchema = await currentDictionary.getSchemasWithFields(schemaFilter);

  const isValid = existingDictionarySchema[0];

  return {
    result: isValid ? ValidationResultType.VALID : ValidationResultType.INVALID,
    message: isValid ? '' : `Record schema of '${fieldValue}' is invalid.`,
  };
};

class DuplicateChecker {
  records: any[] = [];

  validate(record: any, recordIndex: number) {
    const match = this.records.find(previousRecord => isEqual(previousRecord, record));
    if (match) {
      const message = `duplicate rows: ${this.records.indexOf(match) + 1} and ${recordIndex + 1}`;
      return { result: ValidationResultType.INVALID, message };
    } else {
      this.records.push(record);
      return { result: ValidationResultType.VALID, message: '' };
    }
  }
}

const getValidator = <RecordT extends Object>(
  fieldValidators: any,
  fieldName: string,
): Validator<RecordT> => {
  const v = fieldValidators[fieldName];
  if (v) {
    return v;
  } else {
    L.debug(`warning: no validation for ${fieldName}`);
    return () => ({ result: ValidationResultType.VALID, message: '' });
  }
};

/**
 * iterates through each record and runs provided validators
 * @param programId
 * @param records
 * @param fieldValidators
 */
export const validateRecords = async <RecordT extends Object>(
  programId: string,
  records: ReadonlyArray<RecordT>,
  fieldValidators: FieldValidators<RecordT>,
): Promise<ValidationError[]> => {
  let errors: ValidationError[] = [];

  // operates on rows rather than field
  const duplicateChecker = new DuplicateChecker();

  // avoid map to keep async working cleanly (some validators might be async)
  for (const [recordIndex, record] of records.entries()) {
    for (const [fieldName, fieldValue] of Object.entries(record)) {
      const validationResult = await getValidator<RecordT>(
        fieldValidators,
        fieldName,
      )({
        fieldValue,
        fieldName,
        recordIndex,
        record,
        programId,
      });

      const { message, result } = validationResult;
      if (result !== ValidationResultType.VALID) {
        const error = createValidationError({ recordIndex, field: fieldName, result, message });
        errors = errors.concat([error]);
      }
    }
    // row level validations
    const duplicateValidation = duplicateChecker.validate(record, recordIndex);
    const { message, result } = duplicateValidation;
    if (result !== ValidationResultType.VALID) {
      const error = createValidationError({
        recordIndex,
        result,
        message,
        field: '',
      });
      errors = errors.concat([error]);
    }
  }

  return errors;
};

export const commonValidators: FieldValidators<ExceptionRecord> = {
  program_name: checkProgramId,
  schema: checkIsValidDictionarySchema,
  requested_core_field: checkCoreField,
  requested_exception_value: checkRequestedValue,
};
