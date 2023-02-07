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
import { programExceptionRepository } from './exception-repo';
import { ExceptionValueType, ProgramException, ProgramExceptionRecord } from './types';
import {
  checkCoreField,
  checkIsValidSchema,
  checkProgramId,
  checkRequestedValue,
  FieldValidators,
  validateRecords,
  ValidationResult,
} from './validation';

const L = loggerFor(__filename);

const recordsToException = (
  programId: string,
  records: ReadonlyArray<ProgramExceptionRecord>,
): ProgramException => {
  return {
    programId,
    exceptions: records.map(r => ({
      schema: r.schema,
      coreField: r.requested_core_field,
      exceptionValue: r.requested_exception_value as ExceptionValueType,
    })),
  };
};

interface ProgramExceptionResult {
  programException: undefined | DeepReadonly<ProgramException>;
  errors: ValidationResult[];
  successful: boolean;
}

// relates to our TSV cols
export const programValidators: FieldValidators<ProgramExceptionRecord> = {
  program_name: checkProgramId,
  schema: checkIsValidSchema,
  requested_core_field: checkCoreField,
  requested_exception_value: checkRequestedValue,
};

const createResult = ({
  programException = undefined,
  errors,
  successful,
}: ProgramExceptionResult) => ({
  programException,
  errors,
  successful,
});

export namespace operations {
  export const createProgramException = async ({
    programId,
    records,
  }: {
    programId: string;
    records: ReadonlyArray<ProgramExceptionRecord>;
  }): Promise<ProgramExceptionResult> => {
    const errors = await validateRecords<ProgramExceptionRecord>(
      programId,
      records,
      programValidators,
    );

    if (errors.length > 0) {
      return createResult({
        programException: undefined,
        errors,
        successful: false,
      });
    } else {
      const exception = recordsToException(programId, records);
      try {
        const programException = await programExceptionRepository.save(exception);
        return createResult({
          programException,
          errors: [],
          successful: true,
        });
      } catch (e) {
        L.error('error saving exception to database', e);
        return createResult({ programException: undefined, successful: false, errors: [] });
      }
    }
  };
}
