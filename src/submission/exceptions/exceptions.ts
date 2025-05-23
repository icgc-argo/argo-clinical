/*
 * Copyright (c) 2024 The Ontario Institute for Cancer Research. All rights reserved
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
import { DeepReadonly } from 'deep-freeze';
import _ from 'lodash';
import {
	ClinicalEntitySchemaNames,
	FollowupFieldsEnum,
	SpecimenFieldsEnum,
} from '../../common-model/entities';
import entityExceptionRepository from '../../exception/property-exceptions/repo/entity';
import programExceptionRepository from '../../exception/property-exceptions/repo/program';
import {
	EntityException,
	ExceptionRecord,
	ProgramException,
} from '../../exception/property-exceptions/types';
import { fieldFilter } from '../../exception/property-exceptions/validation';
import { getByProgramId as getMissingEntityExceptionByProgram } from '../../exception/missing-entity-exceptions/repo';
import { getByProgramId as getTreatmentDetailExceptionByProgram } from '../../exception/treatment-detail-exceptions/repo';
import { createExceptionManifest } from '../../exception/exception-manifest/index';
import { ExceptionManifestRecord } from '../../exception/exception-manifest/types';
import {
	getDonors,
	getDonorsByIds,
	findDonorsBySubmitterIds,
} from '../../clinical/clinical-service';
import { notEmpty } from '../../utils';
import { SubmittedClinicalRecord } from '../submission-entities';

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
 * Determines if Dictionary field is a numeric field
 * @param valueType
 * @returns true if valueType is 'integer' or 'number'
 */
const isNumericField = (valueType: dictionaryEntities.ValueType | undefined) =>
	valueType === dictionaryEntities.ValueType.INTEGER ||
	valueType === dictionaryEntities.ValueType.NUMBER;

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
	valueType,
}: {
	record: DeepReadonly<TypedDataRecord>;
	programException: ProgramException | null;
	entityException: EntityException | null;
	schemaName: ClinicalEntitySchemaNames;
	fieldValue: string | undefined;
	validationErrorFieldName: string;
	valueType?: dictionaryEntities.ValueType;
}): boolean => {
	const allowedValues: Set<string | undefined> = new Set();

	// program level is applicable to ALL donors
	if (programException) {
		programException.exceptions
			.filter(
				(exception) =>
					exception.requested_core_field === validationErrorFieldName &&
					exception.schema === schemaName,
			)
			.forEach((matchingException) => {
				if (isNumericField(valueType)) {
					allowedValues.add(undefined);
				} else {
					allowedValues.add(matchingException.requested_exception_value);
				}
			});
	}

	if (entityException) {
		const exceptions: ExceptionRecord[] = [];

		switch (schemaName) {
			case ClinicalEntitySchemaNames.SPECIMEN:
				const submitterSpecimenId = record[SpecimenFieldsEnum.submitter_specimen_id] || undefined;
				entityException.specimen
					.filter((exception) => exception.submitter_specimen_id === submitterSpecimenId)
					.forEach((exception) => exceptions.push(exception));
				break;
			case ClinicalEntitySchemaNames.FOLLOW_UP:
				const submitterFollowupId = record[FollowupFieldsEnum.submitter_follow_up_id] || undefined;
				entityException.follow_up
					.filter((exception) => exception.submitter_follow_up_id === submitterFollowupId)
					.forEach((exception) => exceptions.push(exception));
				break;
			case ClinicalEntitySchemaNames.TREATMENT:
				const submitterTreatmentId = record[FollowupFieldsEnum.submitter_treatment_id] || undefined;
				entityException.treatment
					.filter((exception) => exception.submitter_treatment_id === submitterTreatmentId)
					.forEach((exception) => exceptions.push(exception));
				break;
			default:
				// schema is NOT specimen || follow_up || treatment, do not filter for entity exceptions
				break;
		}

		exceptions
			.filter((exception) => exception.requested_core_field === validationErrorFieldName)
			.forEach((matchingException) => {
				if (isNumericField(valueType)) {
					allowedValues.add(undefined);
				} else {
					allowedValues.add(matchingException.requested_exception_value);
				}
			});
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
 * Validate Exception values applied to text fields. Arrays of strings are allowed if they have a single string value.
 */
const isValidStringExceptionType = (
	value: DeepReadonly<dictionaryEntities.SchemaTypes>,
): value is string | [string] => typeof value === 'string' || isSingleString(value);

/**
 * Validate exception values applied to Numeric fields. Allows submitting 'blank' values.
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
	validationErrors,
}: {
	programId: string;
	record: DeepReadonly<TypedDataRecord>;
	schemaName: ClinicalEntitySchemaNames;
	entitySchema: dictionaryEntities.SchemaDefinition | undefined;
	validationErrors: dictionaryEntities.SchemaValidationError[];
}) => {
	const filteredErrors: dictionaryEntities.SchemaValidationError[] = [];
	let normalizedRecord = record;

	// retrieve submitted exceptions for program id (both program level and entity level)
	const { programException, entityException } = await queryForExceptions(programId);

	// if there are submitted exceptions for this program, check if they match record values
	if (!(programException || entityException)) {
		return { filteredErrors: validationErrors, normalizedRecord };
	}

	// check each validation error for a matching exception, and remove the validaiton if the value matches the exception value
	validationErrors.forEach((validationError) => {
		const validationErrorFieldName = validationError.fieldName;
		const fieldValue = record[validationErrorFieldName];
		const fieldSchema = entitySchema?.fields.find(fieldFilter(validationErrorFieldName));

		const valueType = fieldSchema?.valueType;
		const validStringValue = isValidStringExceptionType(fieldValue);
		const validNumericExceptionValue =
			isNumericField(valueType) && isValidNumericExceptionType(fieldValue);

		let normalizedFieldValue: string | undefined = '';
		let normalizedValue: string | string[] = '';

		if (validStringValue || validNumericExceptionValue) {
			if (validStringValue) {
				// get normalized value for record, from either the string value or from the single string inside of the array.
				// we should know from `isAllowedTypeForException` that the fieldValue is one of those two types.
				const stringFieldValue = isSingleString(fieldValue) ? fieldValue[0] : fieldValue;
				const normalizedString = normalizeExceptionValue(stringFieldValue);
				normalizedValue = isSingleString(fieldValue) ? [normalizedString] : normalizedString;

				normalizedFieldValue = normalizedString;
			} else if (validNumericExceptionValue) {
				normalizedFieldValue = fieldValue === '' ? undefined : fieldValue;
			}

			const valueHasException = validateFieldValueWithExceptions({
				record,
				programException,
				entityException,
				schemaName,
				validationErrorFieldName: validationError.fieldName,
				fieldValue: normalizedFieldValue,
				valueType,
			});

			if (valueHasException) {
				// ensure value is normalized exception value
				normalizedRecord = {
					...normalizedRecord,
					[validationErrorFieldName]: normalizedValue, // normalized value keeps this as array for array fields, or string for string fields
				};
			} else {
				filteredErrors.push(validationError);
				// Add validation errors if they are valid exception type, but don't have exceptions
			}
		} else {
			// If field value is not string or number, then value is not a type we allow exceptions for
			filteredErrors.push(validationError);
		}
	});

	return { filteredErrors, normalizedRecord };
};

/**
 * Collect all exception records related to a set of Donors
 *
 * @param programId
 * @param filters
 * @returns [ ExceptionRecords ]
 */
export async function getExceptionManifestRecords(
	programId: string,
	filters: { donorIds: number[]; submitterDonorIds: string[] },
): Promise<ExceptionManifestRecord[]> {
	const { donorIds, submitterDonorIds: querySubmitterIds } = filters;
	const filteredDonors = Boolean(donorIds.length || querySubmitterIds.length);

	const donorsByDonorId = filteredDonors
		? await getDonorsByIds(donorIds)
		: await getDonors(programId);
	const donorsBySubmitterId = (await findDonorsBySubmitterIds(programId, querySubmitterIds)) || [];

	const donors = [...donorsByDonorId, ...donorsBySubmitterId].filter(notEmpty).filter(
		(donorRecord, index, donorArray) =>
			// Filter duplicates
			index === donorArray.findIndex((donor) => donor.donorId === donorRecord.donorId),
	);

	const { programException, entityException } = await queryForExceptions(programId);

	const programExceptions = programException?.exceptions || [];

	const {
		specimen: specimenExceptions,
		follow_up: followUpExceptions,
		treatment: treatmentExceptions,
	} = entityException || {
		specimen: [],
		follow_up: [],
		treatment: [],
	};

	const missingEntityException = await getMissingEntityExceptionByProgram(programId);

	const missingEntitySubmitterIds = missingEntityException?.success
		? missingEntityException.data.donorSubmitterIds
		: [];

	const treatmentDetailException = await getTreatmentDetailExceptionByProgram(programId);

	const treatmentDetailSubmitterIds = treatmentDetailException?.success
		? treatmentDetailException.data.donorSubmitterIds
		: [];

	const exceptionManifest = createExceptionManifest(programId, donors, {
		programExceptions,
		specimenExceptions,
		followUpExceptions,
		treatmentExceptions,
		missingEntitySubmitterIds,
		treatmentDetailSubmitterIds,
	});

	return exceptionManifest;
}

/**
 * Boolean check for existence of exceptions for a specific field
 *
 * @param record
 * @param field
 * @param schema
 * @returns boolean indicating if an exception exists
 */
export const checkForExceptions = async ({
	record,
	field,
	schema,
}: {
	record: DeepReadonly<SubmittedClinicalRecord>;
	field: string;
	schema: string;
}): Promise<boolean> => {
	const programId = record['program_id'] as string;

	if (!programId) return false;

	const programAdditionalSearchParams = { requested_core_field: field };

	const entityAdditionalSearchParams = {
		[`${schema}.requested_core_field`]: field,
	};

	// retrieve submitted exceptions for program id (both program level and entity level)
	const programException = await programExceptionRepository.find(
		programId,
		programAdditionalSearchParams,
	);
	const entityException = await entityExceptionRepository.find(
		programId,
		entityAdditionalSearchParams,
	);

	return notEmpty(programException) || notEmpty(entityException);
};
