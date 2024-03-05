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
import {
	ExceptionType,
	ProgramPropertyExceptionRecord,
	EntityPropertyExceptionRecord,
} from './types';
import {
	EntityExceptionRecord,
	ProgramExceptionRecord,
	isSpecimenExceptionRecord,
	isTreatmentExceptionRecord,
	isFollowupExceptionRecord,
} from '../property-exceptions/types';

export const getSpecimenId = (
	submitter_specimen_id: string,
	specimens: readonly DeepReadonly<Specimen>[],
) => {
	const specimenRecord = specimens.find(
		(specimen) =>
			typeof specimen.submitter_specimen_id === 'string' &&
			specimen.submitter_specimen_id === submitter_specimen_id,
	);
	return specimenRecord?.specimenId;
};

export const getTreatmentId = (
	submitter_treatment_id: string,
	treatments: readonly DeepReadonly<Treatment>[],
) => {
	const treatmentRecord = treatments.find((treatment) =>
		treatment.therapies.some(
			(therapyRecord) =>
				typeof therapyRecord.clinicalInfo.submitter_treatment_id === 'string' &&
				therapyRecord.clinicalInfo.submitter_treatment_id === submitter_treatment_id,
		),
	);
	return treatmentRecord?.treatmentId;
};

export const getFollowUpId = (
	submitter_follow_up_id: string,
	followUps: readonly DeepReadonly<FollowUp>[],
) => {
	const followUpRecord = followUps?.find(
		(followUpRecord) =>
			typeof followUpRecord.clinicalInfo.submitter_follow_up_id === 'string' &&
			followUpRecord.clinicalInfo.submitter_follow_up_id === submitter_follow_up_id,
	);
	return followUpRecord?.followUpId;
};

export const mapProgramExceptions = (programId: string) => (
	exceptionRecord: ProgramExceptionRecord,
): ProgramPropertyExceptionRecord => {
	const exceptionType: ExceptionType = 'ProgramProperty';
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
	const exceptionType: ExceptionType = 'EntityProperty';
	const {
		submitter_donor_id: submitterDonorId,
		schema: schemaName,
		requested_core_field: propertyName,
		requested_exception_value: exceptionValue,
	} = entityExceptionRecord;

	const { donorId, specimens = [], treatments = [], followUps = [] } =
		donors.find((donor) => donor.submitterId === submitterDonorId) || {};

	let submitterEntityId: string | undefined;
	let entityId: DeepReadonly<number | undefined>;

	if (isSpecimenExceptionRecord(entityExceptionRecord)) {
		submitterEntityId = entityExceptionRecord.submitter_specimen_id;
		entityId = getSpecimenId(submitterEntityId, specimens);
	} else if (isTreatmentExceptionRecord(entityExceptionRecord)) {
		submitterEntityId = entityExceptionRecord.submitter_treatment_id;
		entityId = getTreatmentId(submitterEntityId, treatments);
	} else if (isFollowupExceptionRecord(entityExceptionRecord)) {
		submitterEntityId = entityExceptionRecord.submitter_follow_up_id;
		entityId = getFollowUpId(submitterEntityId, followUps);
	}

	return {
		programId,
		exceptionType,
		schemaName,
		propertyName,
		exceptionValue,
		donorId,
		submitterDonorId,
		entityId,
		submitterEntityId,
	};
};
