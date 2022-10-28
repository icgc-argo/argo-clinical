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
import { programExceptionRepository } from './exception-repo';
import { ProgramException, ProgramExceptionRecord } from './types';

const recordsToException = (programId: string, records: any): ProgramException => ({
  programId,
  exceptions: records.map((r: any) => ({
    schema: r.schema,
    coreField: r.requested_core_field,
    exceptionValue: r.requested_exception_value,
  })),
});

export namespace operations {
  export const createProgramException = async ({
    programId,
    records,
  }: {
    programId: string;
    records: any;
  }): Promise<any> => {
    const errors = await validateExceptionRecords(programId, records);

    if (errors.length > 0) {
      return {
        programException: undefined,
        errors,
        successful: false,
      };
    } else {
      const exception = recordsToException(programId, records);

      const result = await programExceptionRepository.create(exception);
      return {
        programException: result,
        errors: [],
        successful: true,
      };
    }
  };
}

interface ValidationError {
  message: string;
  row: number;
}

const validateExceptionRecords = async (
  programId: string,
  records: ReadonlyArray<any>,
): Promise<ValidationError[]> => {
  let errors: ValidationError[] = [];

  for (const [idx, record] of records.entries()) {
    const programErrors = checkProgramId(programId, record, idx);
    const coreFieldErrors = await checkCoreField(record, idx);
    const requestedValErrors = checkRequestedValue(record, idx);
    errors = errors.concat(programErrors, coreFieldErrors, requestedValErrors);
  }

  return errors;
};

const createValidationError = (row: number, message: string) => ({
  row: row + 1, // account for tsc header row
  message,
});

const checkProgramId = (programId: string, record: ProgramExceptionRecord, idx: number) => {
  if (programId !== record.program_name) {
    return [
      createValidationError(
        idx,
        `submitted program id of ${programId} does not match record program id of ${record.program_name}`,
      ),
    ];
  }
  return [];
};

const checkCoreField = async (record: ProgramExceptionRecord, idx: number) => {
  const currentDictionary = await dictionaryManager.instance();

  const requestedCoreField = record.requested_core_field;

  if (requestedCoreField === undefined) {
    return [createValidationError(idx, `requested_core_field field is not defined`)];
  }

  const fieldFilter = (field: any) => {
    return field.name === requestedCoreField && field.meta?.core;
  };

  const schemaFilter = (schema: any) => {
    return schema.name === record.schema;
  };

  const existingDictionarySchema = await currentDictionary.getSchemasWithFields(
    schemaFilter,
    fieldFilter,
  );

  if (existingDictionarySchema[0] && existingDictionarySchema[0].fields.length === 0) {
    return [
      createValidationError(idx, `core field of ${record.requested_core_field} is not valid`),
    ];
  }

  return [];
};

const checkRequestedValue = (record: ProgramExceptionRecord, idx: number) => {
  const validRequests = Object.values(ExceptionValue);
  const requestedExceptionValue = record.requested_exception_value;

  if (requestedExceptionValue === undefined) {
    return [createValidationError(idx, `requested_exception_value field is not defined`)];
  } else if (typeof requestedExceptionValue !== 'string') {
    return [createValidationError(idx, `requested_exception_value is not a string`)];
  } else if (!validRequests.includes(requestedExceptionValue)) {
    return [
      createValidationError(
        idx,
        `requested_exception_value is not valid. must be one of ${validRequests.join(', ')}`,
      ),
    ];
  }
  return [];
};
