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
import { Values } from '../../utils/objectTypes';

// base
export type ExceptionRecord = {
	program_name: string;
	schema: string;
	requested_core_field: string;
	requested_exception_value: string;
};

// program exception
export type ProgramExceptionRecord = ExceptionRecord;

// type after validation
export type ProgramException = {
	programId: string;
	exceptions: ReadonlyArray<ProgramExceptionRecord>;
};

// Entity
export type BaseEntityExceptionRecord = ExceptionRecord & {
	submitter_donor_id: string;
};

export type SpecimenExceptionRecord = BaseEntityExceptionRecord & {
	submitter_specimen_id: string;
};

export type FollowUpExceptionRecord = BaseEntityExceptionRecord & {
	submitter_follow_up_id: string;
};

export type TreatmentExceptionRecord = BaseEntityExceptionRecord & {
	submitter_treatment_id: string;
};

export type EntityExceptionRecord =
	| SpecimenExceptionRecord
	| FollowUpExceptionRecord
	| TreatmentExceptionRecord;
export type EntityExceptionRecords = (
	| SpecimenExceptionRecord
	| FollowUpExceptionRecord
	| TreatmentExceptionRecord
)[];
export type ExceptionRecords =
	| ReadonlyArray<ProgramExceptionRecord>
	| ReadonlyArray<SpecimenExceptionRecord>
	| ReadonlyArray<FollowUpExceptionRecord>
	| ReadonlyArray<TreatmentExceptionRecord>;

/**
 * entity values to be valid EntityException exceptions arrays
 * provide typing to tsv schema string to exception schema string
 */
export const EntityValues: Record<string, Exclude<keyof EntityException, 'programId'>> = {
	specimen: 'specimen',
	follow_up: 'follow_up',
	treatment: 'treatment',
} as const;

export type Entity = Values<typeof EntityValues>;

/**
 * entity keys are same as clinical submission which are the same as dictionary values eg. follow_up
 */
export type EntityException = {
	programId: string;
	specimen: SpecimenExceptionRecord[];
	follow_up: FollowUpExceptionRecord[];
	treatment: TreatmentExceptionRecord[];
};

export type EntityExceptionSchemaNames = Extract<
	ClinicalEntitySchemaNames,
	| ClinicalEntitySchemaNames.SPECIMEN
	| ClinicalEntitySchemaNames.FOLLOW_UP
	| ClinicalEntitySchemaNames.TREATMENT
>;

export const ExceptionValue = {
	Unknown: 'Unknown',
	NotApplicable: 'Not applicable',
} as const;

export type ExceptionValueType = Values<typeof ExceptionValue>;

const baseEntityExceptionFields = [
	'program_name',
	'schema',
	'requested_core_field',
	'requested_exception_value',
	'submitter_donor_id',
];

// type guard helpers
const isExceptionRecordCheck = (input: any) => {
	return (
		// input must not be null and be an object (typeof null = 'object', amusingly)
		typeof input === 'object' &&
		input !== null &&
		// program_name must exist and be string
		'program_name' in input &&
		typeof input.program_name === 'string' &&
		// schema must exist and be string
		'schema' in input &&
		typeof input.schema === 'string' &&
		// requested_core_field must exist and be string
		'requested_core_field' in input &&
		typeof input.requested_core_field === 'string' &&
		// requested_exception_value must exist and be string and be in enum list
		'requested_exception_value' in input &&
		typeof input.requested_exception_value === 'string'
	);
};

export const isSpecimenExceptionRecord = (input: any): input is SpecimenExceptionRecord => {
	return (
		// submitter_specimen_id must exist and be a string
		'submitter_specimen_id' in input && typeof input.submitter_specimen_id === 'string'
	);
};

export const isFollowupExceptionRecord = (input: any): input is FollowUpExceptionRecord => {
	return (
		// submitter_follow_up_id must exist and be a string
		'submitter_follow_up_id' in input && typeof input.submitter_follow_up_id === 'string'
	);
};

export const isTreatmentExceptionRecord = (input: any): input is TreatmentExceptionRecord => {
	return (
		// submitter_treatment_id must exist and be a string
		'submitter_treatment_id' in input && typeof input.submitter_treatment_id === 'string'
	);
};

// type guards
export const isEntityExceptionRecord = (input: any): input is EntityExceptionRecord => {
	const hasDonorIdField =
		'submitter_donor_id' in input && typeof input.submitter_donor_id === 'string';

	if (hasDonorIdField && isExceptionRecord(input)) {
		// remove base exception record fields to validate specific entity
		const entityFields = _.omit(input, baseEntityExceptionFields);
		// can't have more than one identifying field eg. submitter_specimen_id AND submitter_follow_up_id
		return Object.keys(entityFields).length === 1;
	}
	return false;
};

const isExceptionRecord = (input: any): input is ExceptionRecord => isExceptionRecordCheck(input);

/**
 * isProgramExceptionRecord hasn't got any additional logic to isExceptionRecord
 * keeping it defined seperately reads more cleanly and is trivial to alter
 */
export const isProgramExceptionRecord = isExceptionRecord;

// array helpers
export const isArrayOf = <T>(
	input: any[] | readonly any[],
	validator: (_: any) => _ is T,
): input is T[] => {
	return input.every(validator);
};

export const isReadonlyArrayOf = <T>(
	input: ReadonlyArray<any>,
	validator: (_: any) => _ is T,
): input is ReadonlyArray<T> => {
	return input.every(validator);
};

// utility
export type OnlyRequired<T, K extends keyof T> = Omit<Partial<T>, K> & Required<Pick<T, K>>;
