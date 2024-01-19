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
import { TypedDataRecord } from '@overturebio-stack/lectern-client/lib/schema-entities';
import _ from 'lodash';
import {
  ClinicalEntitySchemaNames,
  FollowupFieldsEnum,
  SpecimenFieldsEnum,
} from '../../common-model/entities';
import entityExceptionRepository from '../../exception/repo/entity';
import programExceptionRepository from '../../exception/repo/program';
import { EntityException, ExceptionRecord, ProgramException } from '../../exception/types';
import { DeepReadonly } from 'deep-freeze';

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
const validateFieldValueWithExceptions = ({
  record,
  programException,
  entityException,
  schemaName,
  fieldValue,
  validationErrorFieldName,
}: {
  record: DeepReadonly<TypedDataRecord>;
  programException: ProgramException | null;
  entityException: EntityException | null;
  schemaName: ClinicalEntitySchemaNames;
  fieldValue: string;
  validationErrorFieldName: string;
}): boolean => {
  const allowedValues: Set<string> = new Set();

  // program level is applicable to ALL donors
  if (programException) {
    programException.exceptions
      .filter(
        exception =>
          exception.requested_core_field === validationErrorFieldName &&
          exception.schema === schemaName,
      )
      .forEach(matchingException => allowedValues.add(matchingException.requested_exception_value));
  }

  if (entityException) {
    const exceptions: ExceptionRecord[] = [];

    switch (schemaName) {
      case ClinicalEntitySchemaNames.SPECIMEN:
        const submitterSpecimenId = record[SpecimenFieldsEnum.submitter_specimen_id] || undefined;
        entityException.specimen
          .filter(exception => exception.submitter_specimen_id === submitterSpecimenId)
          .forEach(exception => exceptions.push(exception));
        break;
      case ClinicalEntitySchemaNames.FOLLOW_UP:
        const submitterFollowupId = record[FollowupFieldsEnum.submitter_follow_up_id] || undefined;
        entityException.follow_up
          .filter(exception => exception.submitter_follow_up_id === submitterFollowupId)
          .forEach(exception => exceptions.push(exception));
        break;
      default:
        // schema is neither specimen nor followup, do not filter for entity exceptions
        break;
    }

    exceptions
      .filter(exception => exception.requested_core_field === validationErrorFieldName)
      .forEach(matchingException => allowedValues.add(matchingException.requested_exception_value));
  }

  // check submitted exception value matches record validation error field value
  return allowedValues.has(fieldValue);
};

/**
 * Normalizes input string to start with Upper case, remaining
 * characters lowercase and to trim whitespace
 *
 * @param value
 * @returns normalized string
 */
const normalizeExceptionValue = (value: Readonly<string>) =>
  _.upperFirst(value.trim().toLowerCase());

/**
 * Check if value is exactly matching an array with a single string value.
 */
const isSingleString = (value: DeepReadonly<dictionaryEntities.SchemaTypes>): value is [string] =>
  Array.isArray(value) && value.length === 1 && typeof value[0] === 'string';

/**
 * Exceptions can only be applied to text values. Arrays of strings are allowed if they have a single string value.
 */
const isValidStringExceptionType = (
  value: DeepReadonly<dictionaryEntities.SchemaTypes>,
): value is string | [string] => typeof value === 'string' || isSingleString(value);

/**
 * Exceptions can only be applied to text values. Arrays of strings are allowed if they have a single string value.
 */
const isValidNumericExceptionType = (
  value: DeepReadonly<dictionaryEntities.SchemaTypes>,
): value is undefined | '' => typeof value === 'undefined' || value === '';

/**
 * Check if a valid exception exists and the record value matches it.
 * If there's a match, we allow the value to pass schema validation.
 * Filtered schema validation errors and the normalized record value are returned.
 *
 * Normalizing is setting the value to start Upper case and to trim whitespace.
 *
 * @param programId
 * @param record
 * @param schemaValidationErrors
 */
export const checkForProgramAndEntityExceptions = async ({
  programId,
  record,
  schemaName,
  entitySchema,
  schemaValidationErrors,
}: {
  programId: string;
  record: DeepReadonly<TypedDataRecord>;
  schemaName: ClinicalEntitySchemaNames;
  entitySchema: dictionaryEntities.SchemaDefinition | undefined;
  schemaValidationErrors: dictionaryEntities.SchemaValidationError[];
}) => {
  const filteredErrors: dictionaryEntities.SchemaValidationError[] = [];
  let normalizedRecord = record;

  // retrieve submitted exceptions for program id (both program level and entity level)
  const { programException, entityException } = await queryForExceptions(programId);

  // if there are submitted exceptions for this program, check if they match record values
  if (!(programException || entityException)) {
    return { filteredErrors: schemaValidationErrors, normalizedRecord };
  }

  // check each validation error for a matching exception, and remove the validaiton if the value matches the exception value
  schemaValidationErrors.forEach(validationError => {
    const validationErrorFieldName = validationError.fieldName;
    const fieldValue = record[validationErrorFieldName];

    // Todo: Make Reusable
    const fieldFilter = (field: dictionaryEntities.FieldDefinition): boolean =>
      field.name === validationErrorFieldName;
    const fieldSchema = entitySchema?.fields.find(fieldFilter);
    const valueType = fieldSchema?.valueType;

    const validNumericExceptionValue =
      (valueType === 'number' || valueType === 'integer') &&
      isValidNumericExceptionType(fieldValue);

    // missing required field, validate as normal, exceptions still require a submitted value
    const isMissingRequiredField =
      validationError.errorType ===
      dictionaryEntities.SchemaValidationErrorTypes.MISSING_REQUIRED_FIELD;

    if (isMissingRequiredField) {
      filteredErrors.push(validationError);
      return;
    }

    let normalizedFieldValue = '';
    let normalizedValue: string | string[] = '';

    if (valueType === 'string' && isValidStringExceptionType(fieldValue)) {
      // get normalized value for record, from either the string value or from the single string inside of the array.
      // we should know from `isAllowedTypeForException` that the fieldValue is one of those two types.
      const stringFieldValue = isSingleString(fieldValue) ? fieldValue[0] : fieldValue;
      const normalizedString = normalizeExceptionValue(stringFieldValue);
      normalizedValue = isSingleString(fieldValue) ? [normalizedString] : normalizedString;

      normalizedFieldValue = normalizedString;
    } else if (!validNumericExceptionValue) {
      // Field value is a type we cannot allow exceptions for, validate as normal
      filteredErrors.push(validationError);
      return;
    }

    const valueHasException = validateFieldValueWithExceptions({
      record,
      programException,
      entityException,
      schemaName,
      validationErrorFieldName: validationError.fieldName,
      fieldValue: normalizedFieldValue,
    });

    if (valueHasException) {
      // ensure value is normalized exception value
      normalizedRecord = {
        ...normalizedRecord,
        [validationErrorFieldName]: normalizedValue, // normalized value keeps this as array for array fields, or string for string fields
      };
    } else {
      // only add validation errors that don't have exceptions
      filteredErrors.push(validationError);
    }
  });
  return { filteredErrors, normalizedRecord };
};
