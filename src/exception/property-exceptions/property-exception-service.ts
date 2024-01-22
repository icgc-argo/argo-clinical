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

import _ from 'lodash';
import { ClinicalEntitySchemaNames } from '../../common-model/entities';
import { Result, failure, success } from '../../utils/results';
import { ValidationError } from './error-handling';
import entityExceptionRepository from './repo/entity';
import programExceptionRepository from './repo/program';
import {
	EntityException,
	EntityExceptionRecord,
	FollowUpExceptionRecord,
	OnlyRequired,
	ProgramException,
	ProgramExceptionRecord,
	SpecimenExceptionRecord,
} from './types';
import { isValidEntityType, normalizeEntityFileType } from './util';
import {
	ValidationResultType,
	Validator,
	checkIsValidDictionarySchema,
	commonValidators,
	validateRecords,
} from './validation';

/**
 * creates exception object with tsv style records
 * @param programId
 * @param records
 * @param schema
 * @returns valid EntityException array
 */
const recordsToEntityException = ({
	programId,
	records,
	schema,
}: {
	programId: string;
	records: ReadonlyArray<EntityExceptionRecord>;
	schema: ClinicalEntitySchemaNames;
}) => {
	const exception: OnlyRequired<EntityException, 'programId'> = { programId };

	if (schema === ClinicalEntitySchemaNames.SPECIMEN) {
		exception.specimen = records as SpecimenExceptionRecord[];
	} else if (schema === ClinicalEntitySchemaNames.FOLLOW_UP) {
		exception.follow_up = records as FollowUpExceptionRecord[];
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
	records.map((record) => ({
		...record,
		schema: _.snakeCase(record.schema),
	}));

type AsyncResult<T> = Promise<Result<T>>;

// program exceptions
export const getProgramException = async ({
	programId,
}: {
	programId: string;
}): AsyncResult<ProgramException> => {
	const doc = await programExceptionRepository.find(programId);
	return doc ? success(doc) : failure(`Cannot find program exceptions for ${programId}`);
};

export const deleteProgramException = async ({
	programId,
}: {
	programId: string;
}): AsyncResult<ProgramException> => {
	const doc = await programExceptionRepository.delete(programId);
	return doc ? success(doc) : failure(`Cannot find program exceptions for ${programId}`);
};

export const createProgramException = async ({
	programId,
	records,
}: {
	programId: string;
	records: ReadonlyArray<ProgramExceptionRecord>;
}): AsyncResult<ProgramException> => {
	const errorMessage = `Cannot create exceptions for program '${programId}'`;

	const errors = await validateRecords<ProgramExceptionRecord>(
		programId,
		records,
		commonValidators,
	);

	if (errors.length > 0) {
		throw new ValidationError(errors);
	} else {
		const doc = await programExceptionRepository.save({ programId, exceptions: records });
		return success(doc);
	}
};

// entity exceptions
export const createEntityException = async ({
	programId,
	records,
	schema,
}: {
	programId: string;
	records: ReadonlyArray<EntityExceptionRecord>;
	schema: ClinicalEntitySchemaNames;
}): AsyncResult<EntityException> => {
	const normalizedRecords = normalizeRecords(records);

	/**
	 * specific entity schema record field validator
	 * checks schema field value against the schema type
	 * example: schema field value of "donor" is not valid for "specimen" upload
	 */
	const checkFieldSchema: Validator<EntityExceptionRecord> = ({ record }) => {
		const isValid = record.schema === schema;

		return {
			result: isValid ? ValidationResultType.VALID : ValidationResultType.INVALID,
			message: isValid ? '' : 'Schema in field does not match file upload.',
		};
	};

	/**
	 * perform all checks in one schema validation function
	 * validateRecords can only handle single validator functions not arrays
	 */
	const schemaValidator: Validator<EntityExceptionRecord> = async (args) => {
		const isValidSchemaField = await checkFieldSchema(args);
		const isValidSchemaDict = await checkIsValidDictionarySchema(args);

		const result =
			isValidSchemaField.result === ValidationResultType.VALID &&
			isValidSchemaDict.result === ValidationResultType.VALID
				? ValidationResultType.VALID
				: ValidationResultType.INVALID;

		const message = `${isValidSchemaDict.message} ${isValidSchemaField.message}`.trim();

		return { result, message };
	};

	// use common validators also
	const validators = {
		...commonValidators,
		schema: schemaValidator,
	};

	// columns haven been validated
	// validate data in rows
	const errors = await validateRecords<EntityExceptionRecord>(
		programId,
		normalizedRecords,
		validators,
	);

	if (errors.length > 0) {
		throw new ValidationError(errors);
	}

	const exceptionToSave = recordsToEntityException({ programId, records, schema });
	const doc = await entityExceptionRepository.save(exceptionToSave);
	return success(doc);
};

export const getEntityException = async ({
	programId,
}: {
	programId: string;
}): AsyncResult<EntityException> => {
	const doc = await entityExceptionRepository.find(programId);
	return doc ? success(doc) : failure(`Cannot find entity exceptions for ${programId}`);
};

export const deleteEntityException = async ({
	programId,
	entity,
	submitterDonorIds,
}: {
	programId: string;
	entity: string;
	submitterDonorIds: string[];
}): AsyncResult<EntityException> => {
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
