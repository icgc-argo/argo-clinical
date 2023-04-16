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

import _ from 'lodash';
import { loggerFor } from '../logger';
import { failure, Result, success, ValidationError } from './error-handling';
import entityExceptionRepository from './repo/entity';
import programExceptionRepository from './repo/program';
import { RepoError } from './repo/types';
import {
  Entity,
  EntityException,
  EntityExceptionRecord,
  isArrayOf,
  isFollowupExceptionRecord,
  isSpecimenExceptionRecord,
  OnlyRequired,
  ProgramException,
  ProgramExceptionRecord,
} from './types';
import { isRepoError, normalizeEntityFileType, isValidEntityType } from './util';
import { commonValidators, validateRecords, ValidationResult } from './validation';
import _ from 'lodash';
import { success, ValidationError } from './error-handling';

const L = loggerFor(__filename);

/**
 * creates exception object with tsv style records
 * @param param0
 * @returns valid EntityException array
 */
const recordsToEntityException = ({
  programId,
  records,
}: {
  programId: string;
  records: ReadonlyArray<EntityExceptionRecord>;
}) => {
  const exception: OnlyRequired<EntityException, 'programId'> = { programId };

  if (isArrayOf(records, isSpecimenExceptionRecord)) {
    exception.specimen = records;
  } else if (isArrayOf(records, isFollowupExceptionRecord)) {
    exception.follow_up = records;
  }

  return exception;
};

/**
 * normalize before schema validation
 * tsv record values may contain different casing, validation needs normalized casing
 * eg. tsv record value may be 'Follow Up', this will not pass schema validation for 'follow_up'
 * @param records
 */
const normalizeRecords = (records: readonly EntityExceptionRecord[]) =>
  records.map(r => ({
    ...r,
    schema: _.snakeCase(r.schema),
  }));

/**
 * result handling
 */

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

// export type Result = {
//   success?: boolean;
//   error?: { code: string; message: string }; // api was using this
//   exception?: ProgramException | EntityException | undefined;
//   validationErrors?: ValidationResult[];
// };

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

/**
 * main
 */
export namespace operations {
  /**
   * program exceptions
   */
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

  /**
   * entity exceptions
   */
  export const createEntityException = async ({
    programId,
    records,
  }: {
    programId: string;
    records: ReadonlyArray<EntityExceptionRecord>;
  }): Promise<Result<EntityException>> => {
    const normalizedRecords = normalizeRecords(records);

    // validate rows
    const errors = await validateRecords<EntityExceptionRecord>(
      programId,
      normalizedRecords,
      commonValidators,
    );

    if (errors.length > 0) {
      // ProgramExceptionValidationErr and EntityExceptionValidationErr
      throw new ValidationError(errors);
    }

    const exceptionToSave = recordsToEntityException({ programId, records });
    const doc = await entityExceptionRepository.save(exceptionToSave);
    return success(doc);
  };

  export const getEntityException = async ({
    programId,
  }: {
    programId: string;
  }): Promise<Result<EntityException>> => {
    const doc = await entityExceptionRepository.find(programId);
    return doc ? success(doc) : failure(`Cannot find entity exception for ${programId}`);
  };

  export const deleteEntityException = async ({
    programId,
    entity,
    submitterDonorIds,
  }: {
    programId: string;
    entity: string;
    submitterDonorIds: string[];
  }): Promise<Result<EntityException>> => {
    const normalizedEntityFileType = normalizeEntityFileType(entity);

    if (isValidEntityType(normalizedEntityFileType)) {
      const doc = await entityExceptionRepository.deleteSingleEntity(
        programId,
        normalizedEntityFileType,
        submitterDonorIds,
      );
      return doc ? success(doc) : failure(`Cannot delete entity exception for ${programId}`);
    } else {
      return failure('not a valid entity type');
    }
  };
}
