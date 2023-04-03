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
import { entities as dictionaryEntities } from '@overturebio-stack/lectern-client';
import { DataRecord } from '@overturebio-stack/lectern-client/lib/schema-entities';
import { DeepReadonly } from 'deep-freeze';
import _ from 'lodash';
import entityExceptionRepository from '../../exception/repo/entity';
import programExceptionRepository from '../../exception/repo/program';
import {
  EntityExceptionRecord,
  ExceptionRecords,
  isArrayOfEntityExceptionRecord,
  ProgramException,
  ProgramExceptionRecord,
  SpecimenExceptionRecord,
} from '../../exception/types';
import { isEntityException, isProgramException } from '../../exception/util';

/**
 *
 * @param programId
 * @param record
 * @param schemaValidationErrors
 */
export const checkForProgramOrEntityExceptions = async (
  programId,
  record,
  schemaValidationErrors,
) => {
  let filteredErrors: any[] = [];
  let processedRecord = {};

  const exception = await queryForExceptions(programId);

  if (isProgramException(exception) || isEntityException(exception)) {
    schemaValidationErrors.forEach(validationError => {
      const validationErrorFieldName = validationError.fieldName;
      const recordValue = record[validationErrorFieldName];

      /**
       * Zero Array type exceptions exist, but recordValue type is string | string[]
       * therefore no exception is present for arrays. validation error is valid
       */
      if (Array.isArray(recordValue)) {
        filteredErrors.push(validationError);
        return;
      }

      const normalizedRecordValue = normalizeExceptionValue(recordValue);

      const exceptionExists = validateRecordValueWithExceptions(
        result.exceptions,
        validationError,
        normalizedRecordValue,
      );

      if (exceptionExists) {
        // ensure value is normalized exception value
        const normalizedExceptionRecord = {
          ...record,
          [validationErrorFieldName]: normalizedRecordValue,
        };
        processedRecord = normalizedExceptionRecord;
      } else {
        // only add validation errors that don't have exceptions
        filteredErrors.push(validationError);
      }
    });
    return { filteredErrors, processedRecord };
  } else {
    // no exceptions. return values as is.
    return { filteredErrors: schemaValidationErrors, processedRecord: record };
  }
};

// early return. query for program exceptions, entity, will be arrays
const queryForExceptions = async (programId: string) => {
  // query program exceptions first, because they cover entire programs
  const programException = await programExceptionRepository.find(programId);
  if (isProgramException(programException) || isEntityException(programException)) {
    return programException;
  }

  // if we don't have program exception, query for entity exceptions
  const entityException = await entityExceptionRepository.find(programId);
  return entityException;
};

// CAN I USE GENERICS???

/**
 * Checks if there is a program exception matching the record value
 *
 * @param exceptions
 * @param validationError
 * @param recordValue
 * @returns true if an exception match exists, false otherwise
 */
export const validateRecordValueWithExceptions = (
  exceptions: DeepReadonly<ProgramException['exceptions']>,
  validationError: DeepReadonly<dictionaryEntities.SchemaValidationError>,
  recordValue: string,
): boolean => {
  // missing required field, validate as normal, exceptions still require a submitted value
  if (
    validationError.errorType ===
    dictionaryEntities.SchemaValidationErrorTypes.MISSING_REQUIRED_FIELD
  ) {
    return false;
  } else {
    // find exception for field
    const validationErrorFieldName = validationError.fieldName;
    const exception = findException({ exceptions, record, validationErrorFieldName });

    // check exception value matches error field value
    return exception?.requested_exception_value === record[validationErrorFieldName];
  }
};

const findException = ({
  exceptions,
  record,
  validationErrorFieldName,
}: {
  exceptions: ExceptionRecords;
  record: DataRecord;
  validationErrorFieldName: string;
}): ProgramExceptionRecord | EntityExceptionRecord | undefined => {
  if (isArrayOfEntityExceptionRecord(exceptions)) {
    // entity exception
    return exceptions.find(
      exception =>
        exception.requested_core_field === validationErrorFieldName &&
        findExceptionByEntity({ exception, record }),
    );
  } else {
    // program exception
    return exceptions.find(exception => {
      exception.requested_core_field === validationErrorFieldName;
    });
  }
};

const specimenKeyField: keyof SpecimenExceptionRecord = 'submitter_specimen_id';
const findExceptionByEntity = ({
  exception,
  record,
}: {
  exception: EntityExceptionRecord;
  record: DataRecord;
}) => {
  // keep type checks as string literals, not dynamic properties, for current project TS version 3.9.5
  if ('submitter_specimen_id' in exception) {
    return exception[specimenKeyField] === record[specimenKeyField];
  } else {
    return false;
  }
};

// const applyExceptions = async ({
//   programId,
//   entity,
//   record,
//   schemaValidationErrors,
// }: {
//   programId: string;
//   entity: string;
//   record: dictionaryEntities.DataRecord;
//   schemaValidationErrors: dictionaryEntities.SchemaValidationError[];
// }): Promise<dictionaryEntities.SchemaValidationError[]> => {
//   const t0 = performance.now();
//   // program exceptions and entity exceptions are mutually exclusive

//   // program level exceptions
//   const programExceptionResult = await programExceptionRepository.find(programId);
//   if (isProgramException(programExceptionResult)) {
//     return schemaValidationErrors.filter(
//       validationError =>
//         !isException({ exceptions: programExceptionResult.exceptions, validationError, record }),
//     );
//   }

//   // entity level exceptions
//   const entityExceptionResult = await entityExceptionRepository.find(programId);
//   if (
//     isEntityException(entityExceptionResult) &&
//     (entity === EntityValues.followup || entity === EntityValues.specimen)
//   ) {
//     const entityExceptions = entityExceptionResult[entity];

//     return schemaValidationErrors.filter(
//       validationError => !isException({ exceptions: entityExceptions, validationError, record }),
//     );
//   }

//   const t1 = performance.now();
//   L.debug('apply exceptions time: ' + (t1 - t0));
//   return schemaValidationErrors;
// };

/**
 * Normalizes input string to start with Upper case, remaining
 * characters lowercase and to trim whitespace
 *
 * @param value
 * returns normalized string
 */
export const normalizeExceptionValue = (value: string) => _.upperFirst(value.trim().toLowerCase());
