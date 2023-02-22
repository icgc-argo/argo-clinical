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

import { loggerFor } from '../logger';
import { programExceptionRepository, RepoError } from './exception-repo';
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

/**
 * records should be validated before using this function
 * explicitly typing from tsv record input to ProgramException
 * @param programId
 * @param records
 * @returns ProgramException
 */
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

// relates to our TSV cols
export const programValidators: FieldValidators<ProgramExceptionRecord> = {
  program_name: checkProgramId,
  schema: checkIsValidSchema,
  requested_core_field: checkCoreField,
  requested_exception_value: checkRequestedValue,
};

const createResult = ({
  exception,
  validationErrors = [],
  error = { code: '', message: '' },
  success = false,
}: Result) => ({
  exception,
  error,
  validationErrors,
  success,
});

export type Result = {
  success?: boolean;
  error?: { code: string; message: string };
  exception?: ProgramException | undefined;
  validationErrors?: ValidationResult[];
};

type Service = ({ programId }: { programId: string }) => Promise<Result>;

function isProgramException(result: ProgramException | RepoError): result is ProgramException {
  return (result as ProgramException).programId !== undefined;
}

function processResult({
  result,
  errorMessage,
}: {
  result: ProgramException | RepoError;
  errorMessage: string;
}) {
  const SERVER_ERROR_MSG: string = 'Server error occurred';
  if (isProgramException(result)) {
    return createResult({ success: true, exception: result });
  } else {
    return createResult({
      error: { code: result, message: errorMessage || SERVER_ERROR_MSG },
    });
  }
}
export namespace operations {
  export const getProgramException: Service = async ({ programId }) => {
    const result = await programExceptionRepository.find(programId);

    return processResult({
      result,
      errorMessage: `no program level exceptions for program '${programId}'`,
    });
  };

  export const deleteProgramException: Service = async ({ programId }) => {
    const result = await programExceptionRepository.delete(programId);
    return processResult({
      result,
      errorMessage: `no program level exceptions for program '${programId}'`,
    });
  };

  export const createProgramException = async ({
    programId,
    records,
  }: {
    programId: string;
    records: ReadonlyArray<ProgramExceptionRecord>;
  }): Promise<Result> => {
    const errorMessage = `Cannot create exceptions for program '${programId}'`;

    const errors = await validateRecords<ProgramExceptionRecord>(
      programId,
      records,
      programValidators,
    );

    if (errors.length > 0) {
      return createResult({
        error: { code: RepoError.DOCUMENT_UNDEFINED, message: errorMessage },
        validationErrors: errors,
      });
    } else {
      const exceptionToSave = recordsToException(programId, records);
      const result = await programExceptionRepository.save(exceptionToSave);

      return processResult({
        result,
        errorMessage,
      });
    }
  };
}
