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
import { Donor } from '../../clinical/clinical-entities';
import { EntityException, ProgramExceptionRecord } from '../property-exceptions/types';
import { MissingEntityException } from '../missing-entity-exceptions/model';

import {
	MissingEntityExceptionRecord,
	ProgramPropertyExceptionRecord,
	EntityPropertyExceptionRecord,
	ExceptionManifestRecord,
	ExceptionTypes,
} from './types';

import {
	createProgramExceptions,
	mapEntityExceptionRecords,
	sortExceptionRecordsBySubmitterId,
	sortExceptionRecordsByEntityId,
} from './util';

export const createExceptionManifest = (
	programId: string,
	donors: DeepReadonly<Donor>[],
	programExceptions: ReadonlyArray<ProgramExceptionRecord>,
	entityPropertyException: EntityException | null,
	missingEntitySubmitterIds: string[],
) => {
	// Exceptions only store submitterIds, so all submitterIds have to be collected before we can filter exceptions
	const submitterDonorIds = donors.map((donor) => donor.submitterId);

	const programExceptionRecords: ProgramPropertyExceptionRecord[] = programExceptions.map(
		createProgramExceptions(programId),
	);

	const sortedFollowUpExceptions =
		entityPropertyException?.follow_up.sort(sortExceptionRecordsBySubmitterId) || [];

	const sortedSpecimenExceptions =
		entityPropertyException?.specimen.sort(sortExceptionRecordsBySubmitterId) || [];

	const sortedTreatmentExceptions =
		entityPropertyException?.treatment.sort(sortExceptionRecordsBySubmitterId) || [];

	const entityPropertyRecords: EntityPropertyExceptionRecord[] = [
		...sortedFollowUpExceptions,
		...sortedSpecimenExceptions,
		...sortedTreatmentExceptions,
	]
		.filter((exceptionRecord) => submitterDonorIds.includes(exceptionRecord.submitter_donor_id))
		.map(mapEntityExceptionRecords(programId, donors))
		.sort(sortExceptionRecordsByEntityId);

	const missingEntityRecords: MissingEntityExceptionRecord[] = missingEntitySubmitterIds
		.filter((submitterDonorId) => submitterDonorIds.includes(submitterDonorId))
		.map((submitterDonorId) => {
			const exceptionType = ExceptionTypes.missingEntity;
			const { donorId } = donors.find((donor) => donor.submitterId === submitterDonorId) || {};
			return { programId, exceptionType, submitterDonorId, donorId };
		});

	const exceptionManifest: ExceptionManifestRecord[] = [
		...programExceptionRecords,
		...entityPropertyRecords,
		...missingEntityRecords,
	];

	return exceptionManifest;
};
