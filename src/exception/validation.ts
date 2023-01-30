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

import * as dictionaryManager from '../dictionary/manager';
import { SchemaWithFields } from '../dictionary/manager';
import { loggerFor } from '../logger';
import { ExceptionValue } from './types';

const L = loggerFor(__filename);

export interface ValidationResult {
  message: string;
  recordIndex: number;
  result: ValidationResultType;
}

export enum ValidationResultType {
  VALID = 'valid',
  INVALID = 'invalid',
  EMPTY_FIELD = 'empty_field',
  TYPE_ERROR = 'type_error',
  UNDEFINED = 'undefined',
  PARAM_INVALID = 'PARAM_INVALID',
}

export const createValidationResult = (
  row: number,
  result: ValidationResultType,
  message: string,
): ValidationResult => ({
  recordIndex: row + 1, // account for tsv header row
  result,
  message,
});

export interface Validator<RecordT = { [k: string]: any }> {
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
}

export type FieldValidators<RecordT> = {
  [key in keyof RecordT]: Validator<RecordT>;
};

export const checkCoreField: Validator = async ({ record, recordIndex }) => {
  const currentDictionary = await dictionaryManager.instance();

  const requestedCoreField = record.requested_core_field;

  if (requestedCoreField === undefined) {
    return createValidationResult(
      recordIndex,
      ValidationResultType.UNDEFINED,
      `requested_core_field field is not defined`,
    );
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
  return createValidationResult(
    recordIndex,
    isValid ? ValidationResultType.VALID : ValidationResultType.INVALID,
    isValid ? '' : `core field of ${record.requested_core_field} is not valid`,
  );
};

export const checkProgramId: Validator = ({ record, recordIndex, programId }) => {
  const isValid = programId === record.program_name;
  return createValidationResult(
    recordIndex,
    isValid ? ValidationResultType.VALID : ValidationResultType.PARAM_INVALID,
    isValid
      ? ''
      : `submitted program id of ${programId} does not match record program id of ${record.program_name}`,
  );
};

export const checkRequestedValue: Validator = ({ record, recordIndex }) => {
  const validRequests: string[] = Object.values(ExceptionValue);
  const requestedExceptionValue = record.requested_exception_value;

  if (requestedExceptionValue === undefined) {
    return createValidationResult(
      recordIndex,
      ValidationResultType.UNDEFINED,
      `requested_exception_value field is not defined`,
    );
  } else if (typeof requestedExceptionValue !== 'string') {
    return createValidationResult(
      recordIndex,
      ValidationResultType.TYPE_ERROR,
      `requested_exception_value is not a string`,
    );
  } else if (!validRequests.includes(requestedExceptionValue)) {
    return createValidationResult(
      recordIndex,
      ValidationResultType.INVALID,
      `requested_exception_value is not valid. must be one of ${validRequests.join(', ')}`,
    );
  } else {
    return createValidationResult(recordIndex, ValidationResultType.VALID, '');
  }
};

export const checkForEmptyField: Validator = ({ fieldValue, fieldName, recordIndex }) => {
  const isValid = fieldValue !== '' || !!fieldValue;
  return createValidationResult(
    recordIndex,
    isValid ? ValidationResultType.VALID : ValidationResultType.EMPTY_FIELD,
    !isValid ? `${fieldName} cannot be empty` : '',
  );
};

export const checkIsValidSchema: Validator = async ({ fieldValue, recordIndex }) => {
  if (!fieldValue) {
    return createValidationResult(recordIndex, ValidationResultType.EMPTY_FIELD, 'field is empty');
  }

  const currentDictionary = await dictionaryManager.instance();
  const schemaFilter = (schema: SchemaWithFields): boolean => {
    return schema.name === fieldValue;
  };

  const existingDictionarySchema = await currentDictionary.getSchemasWithFields(schemaFilter);

  const isValid = existingDictionarySchema[0];

  return createValidationResult(
    recordIndex,
    isValid ? ValidationResultType.VALID : ValidationResultType.INVALID,
    isValid ? '' : `record schema of ${fieldValue} is not valid`,
  );
};

const getValidator = <RecordT>(fieldValidators: any, fieldName: string): Validator<RecordT> => {
  const v = fieldValidators[fieldName];
  if (v) {
    return v;
  } else {
    L.debug(`warning: no validation for ${fieldName}`);
    return ({ recordIndex }) => createValidationResult(recordIndex, ValidationResultType.VALID, '');
  }
};

class DuplicateChecker {
  records: any[] = [];

  validate(record: any) {
    if (this.records.some(previousRecord => isEqual(previousRecord, record))) {
      return createValidationResult(0, '', ValidationResultErrorType.INVALID, 'duplicate');
    } else {
      this.records.push(record);
      return createValidationResult(0, '', ValidationResultErrorType.VALID, '');
    }
  }
}

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

      if (validationResult.result !== ValidationResultType.VALID) {
      if (validationResult.result !== ValidationResultErrorType.VALID) {
        errors = errors.concat([validationResult]);
      }
    }
    //
    const duplicateValidation = duplicateChecker.validate(record);
    if (duplicateValidation.result !== ValidationResultErrorType.VALID) {
      errors = errors.concat([duplicateValidation]);
    }
  }

  return errors;
};
