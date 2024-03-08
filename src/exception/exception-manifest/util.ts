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

import { DeepReadonly } from 'deep-freeze';
import { Donor, FollowUp, Specimen, Treatment } from '../../clinical/clinical-entities';
import { ClinicalEntitySchemaNames } from '../../common-model/entities';
import {
	EntityExceptionRecord,
	ProgramExceptionRecord,
	isSpecimenExceptionRecord,
	isTreatmentExceptionRecord,
	isFollowupExceptionRecord,
	Entity,
} from '../property-exceptions/types';
import {
	EntityRecord,
	ExceptionTypes,
	ProgramPropertyExceptionRecord,
	EntityPropertyExceptionRecord,
} from './types';

const idKeys = {
	specimen: 'submitter_specimen_id',
	treatment: 'submitter_treatment_id',
	follow_up: 'submitter_follow_up_id',
};

const entityKeys = {
	[ClinicalEntitySchemaNames.SPECIMEN]: 'specimenId',
	[ClinicalEntitySchemaNames.TREATMENT]: 'treatmentId',
	[ClinicalEntitySchemaNames.FOLLOW_UP]: 'followUpId',
} as const;

function isSpecimen(record: EntityRecord): record is Specimen {
	return entityKeys[ClinicalEntitySchemaNames.SPECIMEN] in record;
}

function isTreatment(record: EntityRecord): record is Treatment {
	return entityKeys[ClinicalEntitySchemaNames.TREATMENT] in record;
}

function isFollowup(record: EntityRecord): record is FollowUp {
	return entityKeys[ClinicalEntitySchemaNames.FOLLOW_UP] in record;
}

const schemaIsEntity = (schema: string): schema is Entity =>
	schema === ClinicalEntitySchemaNames.SPECIMEN ||
	schema === ClinicalEntitySchemaNames.TREATMENT ||
	schema === ClinicalEntitySchemaNames.FOLLOW_UP;

export function getEntityId(
	submitterEntityId: string,
	schema: Entity,
	records: readonly EntityRecord[],
): number | undefined {
	const idKey = idKeys[schema];

	const clinicalRecord = records.find(
		(entityRecord) => entityRecord.clinicalInfo[idKey] === submitterEntityId,
	);

	if (!clinicalRecord) return undefined;

	if (isSpecimen(clinicalRecord)) {
		return clinicalRecord[entityKeys[ClinicalEntitySchemaNames.SPECIMEN]];
	} else if (isFollowup(clinicalRecord)) {
		return clinicalRecord[entityKeys[ClinicalEntitySchemaNames.FOLLOW_UP]];
	} else if (isTreatment(clinicalRecord)) {
		return clinicalRecord[entityKeys[ClinicalEntitySchemaNames.TREATMENT]];
	}
}

export const createProgramExceptions = (programId: string) => (
	exceptionRecord: ProgramExceptionRecord,
): ProgramPropertyExceptionRecord => {
	const exceptionType = ExceptionTypes.programProperty;
	const {
		schema: schemaName,
		requested_core_field: propertyName,
		requested_exception_value: exceptionValue,
	} = exceptionRecord;
	return {
		exceptionType,
		programId,
		schemaName,
		propertyName,
		exceptionValue,
	};
};

export const mapEntityExceptionRecords = (programId: string, donors: DeepReadonly<Donor>[]) => (
	entityExceptionRecord: EntityExceptionRecord,
): EntityPropertyExceptionRecord => {
	const exceptionType = ExceptionTypes.entityProperty;
	const {
		submitter_donor_id: submitterDonorId,
		schema: schemaName,
		requested_core_field: propertyName,
		requested_exception_value: exceptionValue,
	} = entityExceptionRecord;

	const { donorId, specimens = [], treatments = [], followUps = [] } =
		donors.find((donor) => donor.submitterId === submitterDonorId) || {};

	const entityRecord: EntityPropertyExceptionRecord = {
		programId,
		exceptionType,
		schemaName,
		propertyName,
		exceptionValue,
		donorId,
		submitterDonorId,
	};

	// Base Exceptions give type 'string' to schemaName
	const isValidEntity = schemaIsEntity(schemaName);

	if (isValidEntity) {
		if (isSpecimenExceptionRecord(entityExceptionRecord)) {
			entityRecord.submitterEntityId = entityExceptionRecord.submitter_specimen_id;
			entityRecord.entityId = getEntityId(entityExceptionRecord.submitter_specimen_id, schemaName, [
				...specimens,
			]);
		} else if (isTreatmentExceptionRecord(entityExceptionRecord)) {
			entityRecord.submitterEntityId = entityExceptionRecord.submitter_treatment_id;
			entityRecord.entityId = getEntityId(
				entityExceptionRecord.submitter_treatment_id,
				schemaName,
				treatments,
			);
		} else if (isFollowupExceptionRecord(entityExceptionRecord)) {
			entityRecord.submitterEntityId = entityExceptionRecord.submitter_follow_up_id;
			entityRecord.entityId = getEntityId(
				entityExceptionRecord.submitter_follow_up_id,
				schemaName,
				followUps,
			);
		}
	}

	return entityRecord;
};
