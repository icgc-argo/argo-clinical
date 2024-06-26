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

import get from 'lodash/get';
import {
	ActiveRegistration,
	ActiveClinicalSubmission,
	SubmissionValidationError,
	SubmissionValidationUpdate,
} from '../submission/submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { getClinicalEntitiesData } from '../dictionary/api';

const ARRAY_DELIMITER_CHAR = '|';

// Generic Record
type EntityDataRecord = { [k: string]: any; donor_id?: number };

const convertClinicalRecordToGql = (index: number | string, record: EntityDataRecord) => {
	const fields = [];
	for (const field in record) {
		const value = normalizeValue(record[field]);
		fields.push({ name: field, value: value });
	}
	return {
		row: index,
		fields: fields,
	};
};

const convertRegistrationErrorToGql = (errorData: RegistrationErrorData) => ({
	type: errorData.type,
	message: errorData.message,
	row: errorData.index,
	field: errorData.fieldName,
	value: normalizeValue(errorData.info.value),
	sampleId: errorData.info.sampleSubmitterId,
	donorId: errorData.info.donorSubmitterId,
	specimenId: errorData.info.specimenSubmitterId,
});

function normalizeValue(val: unknown) {
	if (Array.isArray(val)) {
		return val.map(convertToString).join(ARRAY_DELIMITER_CHAR);
	}
	return convertToString(val);
}

function convertToString(val: unknown) {
	return val === undefined || val === null ? '' : `${val}`;
}

const convertClinicalFileErrorToGql = (
	fileError: DeepReadonly<{
		message: string;
		batchNames: string[];
		code: string;
	}>,
) => {
	return {
		message: fileError.message,
		fileNames: fileError.batchNames,
		code: fileError.code,
	};
};

const convertRegistrationDataToGql = (
	programShortName: string,
	data: {
		registration: DeepReadonly<ActiveRegistration> | undefined;
		errors?: RegistrationErrorData[];
		batchErrors?: { message: string; batchNames: string[]; code: string }[];
	},
) => {
	const registration: Partial<typeof data.registration> = get(data, 'registration', {});
	const schemaAndValidationErrors: typeof data.errors = get(data, 'errors', []);
	const fileErrors: typeof data.batchErrors = get(data, 'batchErrors', []);
	const records = get(registration, 'records', []);
	const newDonors = get(registration, 'stats.newDonorIds', []);
	const newSpecimens = get(registration, 'stats.newSpecimenIds', []);
	const newSamples = get(registration, 'stats.newSampleIds', []);
	const alreadyRegistered = get(registration, 'stats.alreadyRegistered', []);

	return {
		id: registration._id,
		programShortName,
		creator: registration.creator,
		fileName: registration.batchName,
		createdAt: registration.createdAt,
		records: () => records.map((record, i) => convertClinicalRecordToGql(i, record)),
		errors: schemaAndValidationErrors.map(convertRegistrationErrorToGql),
		fileErrors: fileErrors.map(convertClinicalFileErrorToGql),
		newDonors: () => convertRegistrationStatsToGql(newDonors),
		newSpecimens: () => convertRegistrationStatsToGql(newSpecimens),
		newSamples: () => convertRegistrationStatsToGql(newSamples),
		alreadyRegistered: () => convertRegistrationStatsToGql(alreadyRegistered),
	};
};

const convertRegistrationStatsToGql = (
	statsEntry: {
		submitterId: string;
		rowNumbers: (string | number)[];
	}[],
) => {
	const output = {
		count: 0,
		rows: [] as (string | number)[],
		names: [] as string[],
		values: [] as { name: string; rows: (string | number)[] }[],
	};
	const names = statsEntry.map((se) => se.submitterId) || ([] as string[]);
	output.count = names.length;
	names.forEach((name) => {
		output.names.push(name);
		const rows = statsEntry.find((se) => se.submitterId == name)?.rowNumbers || [];
		rows.forEach((row) => !output.rows.includes(row) && output.rows.push(row));
		output.values.push({ name, rows });
	});

	return output;
};

type RegistrationErrorData = ErrorData & {
	info: {
		value: string;
		sampleSubmitterId: string;
		donorSubmitterId: string;
		specimenSubmitterId: string;
	};
};

type ErrorData = {
	type: string;
	message: string;
	index: number | string;
	fieldName: string;
};

// Clinical Submission

export interface SubmissionEntity {
	batchName?: string | undefined;
	creator?: string | undefined;
	records?: ReadonlyArray<Readonly<{ [key: string]: string }>> | undefined;
	createdAt?: DeepReadonly<Date> | undefined;
	schemaErrors?: DeepReadonly<SubmissionValidationError[]> | undefined;
	dataErrors?: DeepReadonly<SubmissionValidationError[]> | undefined;
	dataWarnings?: DeepReadonly<SubmissionValidationError[]> | undefined;
	dataUpdates?: DeepReadonly<SubmissionValidationUpdate[]> | undefined;
	stats?:
		| DeepReadonly<{
				new: number[];
				noUpdate: number[];
				updated: number[];
				errorsFound: number[];
		  }>
		| undefined;
}

const convertClinicalSubmissionEntityToGql = (clinicalType: string, entity: SubmissionEntity) => {
	const batchName = entity?.batchName;
	const creator = entity?.creator || undefined;
	const records = get(entity, 'records', [] as typeof entity.records)?.map((record, index) =>
		convertClinicalRecordToGql(index, record),
	);
	const stats = entity?.stats || undefined;
	const entityErrors = entity.schemaErrors || [];
	const schemaErrors = entityErrors.map((error) =>
		convertClinicalSubmissionSchemaErrorToGql(clinicalType, error),
	);
	const dataErrors = get(
		entity,
		'dataErrors',
		[] as typeof entity.dataErrors,
	)?.map((error: ErrorData) => convertClinicalSubmissionDataErrorToGql(error));
	const dataWarnings = get(
		entity,
		'dataWarnings',
		[] as typeof entity.dataWarnings,
	)?.map((warning: ErrorData) => convertClinicalSubmissionDataErrorToGql(warning));
	const dataUpdates = get(entity, 'dataUpdates', [] as typeof entity.dataUpdates)?.map((update) =>
		convertClinicalSubmissionUpdateToGql(update),
	);
	const createdAt = entity.createdAt ? entity.createdAt : undefined;

	return {
		clinicalType,
		batchName,
		creator,
		records,
		stats,
		schemaErrors,
		dataErrors,
		dataWarnings,
		dataUpdates,
		createdAt,
	};
};

const convertClinicalSubmissionSchemaErrorToGql = (
	clinicalType: unknown,
	errorData: ErrorData,
) => ({
	...convertClinicalSubmissionDataErrorToGql(errorData),
	clinicalType,
});

const convertClinicalSubmissionDataErrorToGql = (errorData: ErrorData) => {
	// errorData.info.value may come back as null if not provided in uploaded file
	const errorValue = get(errorData, 'info.value', '') || '';
	return {
		type: errorData.type,
		message: errorData.message,
		row: errorData.index,
		field: errorData.fieldName,
		donorId: get(errorData, 'info.donorSubmitterId', '') || '',
		value: normalizeValue(errorValue),
	};
};

type UpdateData = {
	index: string | number;
	fieldName: string;
	info: {
		newValue: unknown;
		oldValue: unknown;
		donorSubmitterId: string;
	};
};

const convertClinicalSubmissionUpdateToGql = (updateData: UpdateData) => {
	return {
		row: updateData.index,
		field: updateData.fieldName,
		newValue: normalizeValue(updateData.info.newValue),
		oldValue: normalizeValue(updateData.info.oldValue),
		donorId: updateData.info.donorSubmitterId,
	};
};

const convertClinicalSubmissionDataToGql = async (
	programShortName: string,
	data: {
		submission: DeepReadonly<ActiveClinicalSubmission> | undefined;
		batchErrors?: DeepReadonly<{ message: string; batchNames: string[]; code: string }[]>;
		successful?: boolean; // | undefined;
	},
) => {
	const submission = get(data, 'submission', {} as Partial<typeof data.submission>);
	const fileErrors = get(data, 'batchErrors', [] as typeof data.batchErrors);
	const clinicalEntities = get(submission, 'clinicalEntities');

	const clinicalSubmissionTypeList = await getClinicalEntitiesData('false'); // to confirm for true or false
	const filledClinicalEntities = clinicalSubmissionTypeList.map((clinicalType) => ({
		clinicalType,
		...(clinicalEntities ? clinicalEntities[clinicalType.name] : {}),
	}));
	const clinicalEntityMap = filledClinicalEntities.map((clinicalEntity) =>
		convertClinicalSubmissionEntityToGql(clinicalEntity?.clinicalType.name, clinicalEntity),
	);

	return {
		id: submission?._id || undefined,
		programShortName,
		state: submission?.state || undefined,
		version: submission?.version || undefined,
		updatedBy: submission?.updatedBy || undefined,
		updatedAt: submission?.updatedAt ? submission.updatedAt : undefined,
		clinicalEntities: clinicalEntityMap,
		fileErrors: fileErrors?.map(convertClinicalFileErrorToGql),
	};
};

export {
	convertClinicalRecordToGql,
	convertRegistrationDataToGql,
	convertRegistrationErrorToGql,
	convertClinicalFileErrorToGql,
	convertRegistrationStatsToGql,
	RegistrationErrorData,
	convertClinicalSubmissionEntityToGql,
	convertClinicalSubmissionDataToGql,
};
