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
import { default as entityExceptionRepository } from './repo/entity';
import programExceptionRepository from './repo/program';
import { RepoError } from './repo/types';
import {
  Entity,
  EntityException,
  EntityExceptionRecord,
  ExceptionValueType,
  ProgramException,
  ProgramExceptionRecord,
  SpecimenExceptionRecord,
} from './types';
import { isRepoError } from './util';
import { commonValidators, validateRecords, ValidationResult } from './validation';

const L = loggerFor(__filename);

const recordsToEntityException = (
  programId: string,
  records: EntityExceptionRecord[],
): EntityException => {
  return {
    programId,
    specimen: records,
  };
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
  exception?: ProgramException | EntityException | undefined;
  validationErrors?: ValidationResult[];
};

type Service = ({ programId }: { programId: string }) => Promise<Result>;

function processResult({
  result,
  errorMessage,
}: {
  result: ProgramException | EntityException | RepoError;
  errorMessage: string;
}) {
  const SERVER_ERROR_MSG: string = 'Server error occurred';

  if (isRepoError(result)) {
    return createResult({
      error: { code: result, message: errorMessage || SERVER_ERROR_MSG },
    });
  } else {
    return createResult({ success: true, exception: result });
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
      commonValidators,
    );

    if (errors.length > 0) {
      return createResult({
        error: { code: RepoError.DOCUMENT_UNDEFINED, message: errorMessage },
        validationErrors: errors,
      });
    } else {
      const result = await programExceptionRepository.save({ programId, exceptions: records });

      return processResult({
        result,
        errorMessage,
      });
    }
  };

  export const createEntityException = async ({
    programId,
    records,
  }: {
    programId: string;
    records: ReadonlyArray<EntityExceptionRecord>;
    entity?: Entity;
  }): Promise<Result> => {
    const errorMessage = `Cannot create exceptions for ${'specimen'} entity in program '${programId}'`;

    const errors = await validateRecords<EntityExceptionRecord>(
      programId,
      records,
      commonValidators,
    );

    if (errors.length > 0) {
      return createResult({
        error: { code: RepoError.DOCUMENT_UNDEFINED, message: errorMessage },
        validationErrors: errors,
      });
    } else {
      const exceptionToSave = recordsToEntityException(programId, [...records]);

      const result = await entityExceptionRepository.save(exceptionToSave);

      return processResult({
        result,
        errorMessage,
      });
    }
  };

  const deleteEntity = async (programId: string, entity: Entity) => {
    let result, errorMessage;
    if (entity) {
      result = await entityExceptionRepository.deleteSingleEntity(programId, entity);
      errorMessage = `no ${entity} entity exceptions for program '${programId}'`;
    } else {
      result = await entityExceptionRepository.delete(programId);
      errorMessage = `no entity exceptions for program '${programId}'`;
    }
    return { result, errorMessage };
  };

  export const deleteEntityException = async ({
    programId,
    entity,
  }: {
    programId: string;
    entity: Entity;
  }) => {
    const { result, errorMessage } = await deleteEntity(programId, entity);
    return processResult({
      // @ts-expect-error v3.9.5, no yelling in v4
      result,
      errorMessage,
    });
  };
}
