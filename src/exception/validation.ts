/*
 * Copyright (c) 2022 The Ontario Institute for Cancer Research. All rights reserved
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

export type ValidationResult = {
  message: string;
  result: ValidationResultErrorType;
};

export const ValidationResultErrorType = {
  VALID: 'VALID',
  INVALID: 'INVALID',
  EMPTY_FIELD: 'EMPTY_FIELD',
  TYPE_ERROR: 'TYPE_ERROR',
  UNDEFINED: 'UNDEFINED',
  PARAM_INVALID: 'INVALID_PARAM',
} as const;

type ValidationResultErrorType = ObjectValues<typeof ValidationResultErrorType>;

type ValidationError = {
  field: string;
  recordIndex: number;
} & ValidationResult;
export const createValidationError = ({
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

export type FieldValidators<RecordT extends Object> = {
  [key in keyof RecordT]: Validator<RecordT>;
};

export const checkCoreField: Validator<ExceptionRecord> = async ({ record, fieldName }) => {
  const currentDictionary = await dictionaryManager.instance();

  const requestedCoreField = record.requested_core_field;

  if (requestedCoreField === undefined) {
    return {
      result: ValidationResultErrorType.UNDEFINED,
      message: `${fieldName} value is not defined`,
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
    result: isValid ? ValidationResultErrorType.VALID : ValidationResultErrorType.INVALID,
    message: isValid ? '' : `${fieldName} value of '${record.requested_core_field}' is not valid`,
  };
};

export const checkProgramId: Validator<ProgramExceptionRecord> = ({
  record,
  programId,
  fieldName,
}) => {
  const result =
    programId === record.program_name
      ? ValidationResultErrorType.VALID
      : ValidationResultErrorType.PARAM_INVALID;

  const message =
    result !== ValidationResultErrorType.VALID
      ? `submitted exception '${fieldName}' of '${record.program_name}' does not match request parameter program id of '${programId}'`
      : '';
  return { result, message };
};

export const checkRequestedValue: Validator<ExceptionRecord> = ({ record, fieldName }) => {
  const validRequests: string[] = Object.values(ExceptionValue);
  const requestedExceptionValue = record.requested_exception_value;

  if (requestedExceptionValue === undefined) {
    return {
      result: ValidationResultErrorType.UNDEFINED,
      message: `${fieldName} value is not defined`,
    };
  } else if (typeof requestedExceptionValue !== 'string') {
    return {
      result: ValidationResultErrorType.TYPE_ERROR,
      message: `${fieldName} value is not a string`,
    };
  } else if (!validRequests.includes(requestedExceptionValue)) {
    return {
      result: ValidationResultErrorType.INVALID,
      message: `${fieldName} value is not valid. Must be one of [${validRequests.join(', ')}]`,
    };
  } else {
    return { result: ValidationResultErrorType.VALID, message: '' };
  }
};

export const checkForEmptyField: Validator<ExceptionRecord> = ({
  fieldValue,
  fieldName,
}): ValidationResult => {
  const isValid = fieldValue !== '' || !!fieldValue;
  const errorMessage = `${fieldName} cannot be empty`;

  return {
    result: isValid ? ValidationResultErrorType.VALID : ValidationResultErrorType.EMPTY_FIELD,
    message: isValid ? '' : errorMessage,
  };
};

export const checkIsValidSchema: Validator<ExceptionRecord> = async ({ fieldValue }) => {
  const errorMessage = 'field is empty';
  if (!fieldValue) {
    return {
      result: ValidationResultErrorType.EMPTY_FIELD,
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
    result: isValid ? ValidationResultErrorType.VALID : ValidationResultErrorType.INVALID,
    message: isValid ? '' : `record schema of ${fieldValue} is not valid`,
  };
};

class DuplicateChecker {
  records: any[] = [];

  validate(record: any, recordIndex: number) {
    const match = this.records.find(previousRecord => isEqual(previousRecord, record));
    if (match) {
      const message = `duplicate rows: ${this.records.indexOf(match) + 1} and ${recordIndex + 1}`;
      return { result: ValidationResultErrorType.INVALID, message };
    } else {
      this.records.push(record);
      return { result: ValidationResultErrorType.VALID, message: '' };
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
    return () => ({ result: ValidationResultErrorType.VALID, message: '' });
  }
};

export const validateRecords = async <RecordT extends Object>(
  programId: string,
  records: ReadonlyArray<RecordT>,
  fieldValidators: FieldValidators<RecordT>,
): Promise<ValidationResult[]> => {
  let errors: ValidationResult[] = [];

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
      if (result !== ValidationResultErrorType.VALID) {
        const error = createValidationError({ recordIndex, field: fieldName, result, message });
        errors = errors.concat([error]);
      }
    }
    // row level validations
    const duplicateValidation = duplicateChecker.validate(record, recordIndex);
    const { message, result } = duplicateValidation;
    if (result !== ValidationResultErrorType.VALID) {
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
