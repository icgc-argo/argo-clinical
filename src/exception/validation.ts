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

import { ProgramExceptionRecord, ExceptionValue } from './types';
import * as dictionaryManager from '../dictionary/manager';
import { SchemaWithFields } from '../dictionary/manager';
import { loggerFor } from '../logger';
import { createValidationErrors, ValidationError } from './error';

const L = loggerFor(__filename);

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
  }): Promise<ValidationError[]> | ValidationError[];
}

export type FieldValidators<RecordT> = {
  [key in keyof RecordT]: Validator<RecordT>;
};

export const checkCoreField: Validator = async ({ record, recordIndex }) => {
  const currentDictionary = await dictionaryManager.instance();
  console.log('current dictionary', currentDictionary);

  const requestedCoreField = record.requested_core_field;

  if (requestedCoreField === undefined) {
    return createValidationErrors(recordIndex, `requested_core_field field is not defined`);
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
  console.log('EXISTING SCHEMA', existingDictionarySchema);

  if (existingDictionarySchema[0] && existingDictionarySchema[0].fields.length === 0) {
    return createValidationErrors(
        recordIndex,
        `core field of ${record.requested_core_field} is not valid`,
      ),
    ;
  }

  return [];
};

export const checkProgramId: Validator = ({ record, recordIndex, programId }) => {
  if (programId !== record.program_name) {
    return createValidationErrors(
        recordIndex,
        `submitted program id of ${programId} does not match record program id of ${record.program_name}`,
      );
  }
  return [];
};

export const checkRequestedValue: Validator = ({ record, recordIndex }) => {
  const validRequests: string[] = Object.values(ExceptionValue);
  const requestedExceptionValue = record.requested_exception_value;

  if (requestedExceptionValue === undefined) {
    return createValidationErrors(recordIndex, `requested_exception_value field is not defined`);
  } else if (typeof requestedExceptionValue !== 'string') {
    return createValidationErrors(recordIndex, `requested_exception_value is not a string`);
  } else if (!validRequests.includes(requestedExceptionValue)) {
    return createValidationErrors(
        recordIndex,
        `requested_exception_value is not valid. must be one of ${validRequests.join(', ')}`,
      ),
    
  }
  return [];
};

export const checkForEmptyField: Validator = ({ fieldValue, fieldName, recordIndex }) => {
  return fieldValue !== '' || !!fieldValue
    ? []
    : createValidationErrors(recordIndex, `${fieldName} cannot be empty`);
};

const getValidator = <RecordT>(fieldValidators: any, fieldName: string): Validator<RecordT> => {
  const v = fieldValidators[fieldName];
  if (v) {
    return v;
  } else {
    L.info(`warning: no validation for ${fieldName}`);
    return () => [];
  }
};

// TODO : validateRecords. we're in exceptions land
// TODO: why is this better? Ensure every field has some kind of validation run , even just not empty
export const validateRecords = async <RecordT>(
  programId: string,
  records: ReadonlyArray<RecordT>,
  fieldValidators: FieldValidators<RecordT>,
): Promise<ValidationError[]> => {
  let errors: ValidationError[] = [];

  // avoid map to keep async working cleanly (some validators might be async)
  for (const [recordIndex, record] of records.entries()) {
    console.log('record', record);
    for (const [fieldName, fieldValue] of Object.entries(record)) {
      console.log('field', fieldName, fieldValue);
      const e = await getValidator<RecordT>(
        fieldValidators,
        fieldName,
      )({
        fieldValue,
        fieldName,
        recordIndex,
        record,
        programId,
      });
      console.log('eeee', e);
      errors = errors.concat(e);
    }
  }
  console.log('errors', errors);
  return errors;
};

// TODO: !why pass in record? if we are validating per field, just pass in fieldValue, fieldName, idx, prgoram id
