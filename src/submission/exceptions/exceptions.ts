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
import _ from 'lodash';
import { ClinicalEntitySchemaNames } from '../../common-model/entities';
import entityExceptionRepository from '../../exception/repo/entity';
import programExceptionRepository from '../../exception/repo/program';
import { RepoError } from '../../exception/repo/types';
import { EntityException, ExceptionRecord, ProgramException } from '../../exception/types';
import { isEntityException, isProgramException } from '../../exception/util';

/**
 * Check if a valid exception exists and the record value matches it
 * If there's a match, we allow the value to pass schema validation
 * Filtered schema validation errors and the normalized record value are returned
 *
 * Normalizing is setting the value to start Upper case and to trim whitespace
 *
 * @param programId
 * @param record
 * @param schemaValidationErrors
 */
export const checkForProgramAndEntityExceptions = async ({
  programId,
  record,
  schemaName,
  schemaValidationErrors,
}: {
  programId: string;
  record: DataRecord;
  schemaName: ClinicalEntitySchemaNames;
  schemaValidationErrors: dictionaryEntities.SchemaValidationError[];
}) => {
  const filteredErrors: dictionaryEntities.SchemaValidationError[] = [];
  let normalizedRecord = {};

  // retrieve submitted exceptions for program id (both program level and donor level)
  const { programException, entityException } = await queryForExceptions(programId);

  // if there are submitted exceptions for this program, check if they match record values
  if (isProgramException(programException) || isEntityException(entityException)) {
    schemaValidationErrors.forEach(validationError => {
      const validationErrorFieldName = validationError.fieldName;
      const fieldValue = record[validationErrorFieldName];

      /**
       * Zero Array type exceptions exist, but recordValue type is string | string[]
       * therefore no exception is present for arrays. validation error is valid
       */
      if (Array.isArray(fieldValue)) {
        filteredErrors.push(validationError);
        return;
      }

      // normalize submitted record field value to match submitted exceptions
      const normalizedFieldValue = normalizeExceptionValue(fieldValue);

      // missing required field, validate as normal, exceptions still require a submitted value
      const isMissingRequiredField =
        validationError.errorType ===
        dictionaryEntities.SchemaValidationErrorTypes.MISSING_REQUIRED_FIELD;

      const valueHasException = !isMissingRequiredField
        ? validateFieldValueWithExceptions({
            programException,
            entityException,
            schemaName,
            fieldValue: normalizedFieldValue,
            validationErrorFieldName: validationError.fieldName,
          })
        : false;

      if (valueHasException) {
        // ensure value is normalized exception value
        const normalizedExceptionRecord = {
          ...record,
          [validationErrorFieldName]: normalizedFieldValue,
        };
        normalizedRecord = normalizedExceptionRecord;
      } else {
        // only add validation errors that don't have exceptions
        filteredErrors.push(validationError);
      }
    });
    return { filteredErrors, normalizedRecord };
  } else {
    // no exceptions. return values without change.
    return { filteredErrors: schemaValidationErrors, normalizedRecord: record };
  }
};

/**
 * query db for program or entity exceptions
 * @param programId
 * @returns program and donor level exceptions for this programId
 */
const queryForExceptions = async (programId: string) => {
  const programException = await programExceptionRepository.find(programId);
  const entityException = await entityExceptionRepository.find(programId);
  return { programException, entityException };
};

/**
 * Checks if there is a program exception or entity exception matching the record value
 *
 * @param exceptions
 * @param validationError
 * @param fieldValue
 * @returns true if an exception match exists, false otherwise
 */
export const validateFieldValueWithExceptions = ({
  programException,
  entityException,
  schemaName,
  fieldValue,
  validationErrorFieldName,
}: {
  programException: ProgramException | RepoError;
  entityException: EntityException | RepoError;
  schemaName: ClinicalEntitySchemaNames;
  fieldValue: string;
  validationErrorFieldName: string;
}): boolean => {
  let exceptionValue: string | undefined = '';
  // program level is applicable to ALL donors
  if (isProgramException(programException)) {
    exceptionValue = programException.exceptions.find(exception => {
      exception.requested_core_field === validationErrorFieldName;
    })?.requested_core_field;
  } else if (isEntityException(entityException)) {
    const exceptionSchemaName = mapClinicalEntityNameToExceptionName(schemaName);
    if (exceptionSchemaName) {
      const exceptions: Array<ExceptionRecord> = entityException[exceptionSchemaName];
      exceptionValue = exceptions.find(
        exception => exception.requested_core_field === validationErrorFieldName,
      )?.requested_exception_value;
    } else {
      return false;
    }
  }
  // check submitted exception value matches record validation error field value
  return exceptionValue === fieldValue;
};

/**
 * Normalizes input string to start with Upper case, remaining
 * characters lowercase and to trim whitespace
 *
 * @param value
 * @returns normalized string
 */
export const normalizeExceptionValue = (value: string) => _.upperFirst(value.trim().toLowerCase());

/**
 * map uploaded clinical type schema name with underscores to exception schema name camel cased
 * eg. follow_up: 'followUp',
 * Partial<> until all donor entities are accounted for
 * @param schemaName
 */

const clinicalEntities: Partial<Record<
  ClinicalEntitySchemaNames,
  Exclude<keyof EntityException, 'programId'>
>> = {
  // donor: 'donor',
  specimen: 'specimen',
  //   primary_diagnosis: 'primaryDiagnoses',
  //   family_history: 'familyHistory',
  //   treatment: 'treatment',
  //   chemotherapy: 'chemotherapy',
  //   immunotherapy: 'immunotherapy',
  //   surgery: 'surgery',
  //   radiation: 'radiation',
  //   follow_up: 'followUps',
  //   hormone_therapy: 'hormoneTherapy',
  //   exposure: 'exposure',
  //   comorbidity: 'comorbidity',
  //   biomarker: 'biomarker',
  //   sample_registration: 'sampleRegistration',
};

const mapClinicalEntityNameToExceptionName = (schemaName: ClinicalEntitySchemaNames) =>
  clinicalEntities[schemaName];
