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
	EntityPropertyExceptionType,
	ProgramExceptionType,
	ProgramPropertyExceptionRecord,
	EntityPropertyExceptionRecord,
} from './types';

const idKeys = {
	specimen: 'submitter_specimen_id',
	treatment: 'submitter_treatment_id',
	follow_up: 'submitter_follow_up_id',
};

const entityKeys = {
	specimen: 'specimenId',
	treatment: 'treatmentId',
	follow_up: 'followUpId',
};

export function getEntityId(
	submitterEntityId: string,
	schema: string,
	records: readonly EntityRecord[],
): number | undefined {
	const schemaIsEntity = (schema: string): schema is Entity =>
		schema === ClinicalEntitySchemaNames.SPECIMEN ||
		schema === ClinicalEntitySchemaNames.TREATMENT ||
		schema === ClinicalEntitySchemaNames.FOLLOW_UP;

	if (!schemaIsEntity(schema)) return undefined;

	const idKey = idKeys[schema];
	const entityKey = entityKeys[schema];

	const clinicalRecord = records.find(
		(entityRecord) => entityRecord.clinicalInfo[idKey] === submitterEntityId,
	);

	if (!clinicalRecord) return undefined;

	const entityId:
		| Specimen['specimenId']
		| Treatment['treatmentId']
		| FollowUp['followUpId'] = Number(clinicalRecord[entityKey]);

	return entityId;
}

export const createProgramExceptions = (programId: string) => (
	exceptionRecord: ProgramExceptionRecord,
): ProgramPropertyExceptionRecord => {
	const exceptionType = ProgramExceptionType;
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
	const exceptionType = EntityPropertyExceptionType;
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

	return entityRecord;
};
