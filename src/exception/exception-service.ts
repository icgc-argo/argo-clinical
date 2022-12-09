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

import { DeepReadonly } from 'deep-freeze';
import { loggerFor } from '../logger';
import * as dictionaryManager from '../dictionary/manager';
import { SchemaWithFields } from '../dictionary/manager';
import { ProgramExceptionModel, programExceptionRepository } from './exception-repo';
import { ExceptionValue, ProgramException, ProgramExceptionRecord } from './types';
import {
  checkCoreField,
  checkForEmptyField,
  checkProgramId,
  checkRequestedValue,
  FieldValidators,
  validateRecords,
  ValidationError,
  Validator,
} from './validation';

const L = loggerFor(__filename);

const recordsToException = (
  programId: string,
  records: ReadonlyArray<ProgramExceptionRecord>,
): ProgramException => ({
  programId,
  exceptions: records.map(r => ({
    schema: r.schema,
    coreField: r.requested_core_field,
    exceptionValue: r.requested_exception_value,
  })),
});

interface ProgramExceptionResult {
  programException: undefined | DeepReadonly<ProgramException>;
  errors: ValidationError[];
  successful: boolean;
}

export const programValidators: FieldValidators<ProgramExceptionRecord> = {
  program_name: checkProgramId,
  schema: checkForEmptyField,
  requested_core_field: checkCoreField,
  requested_exception_value: checkRequestedValue,
};

export namespace operations {
  export const createProgramException = async ({
    programId,
    records,
  }: {
    programId: string;
    records: ReadonlyArray<ProgramExceptionRecord>;
  }): Promise<ProgramExceptionResult> => {
    L.info(JSON.stringify(records));
    const errors = await validateRecords<ProgramExceptionRecord>(
      programId,
      records,
      programValidators,
    );

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
