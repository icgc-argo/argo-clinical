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
import { donorDao as donorRepo } from '../../clinical/donor-repo';
import { loggerFor } from '../../logger';
import { updateDonorsCompletionStats } from '../../submission/submission-to-clinical/stat-calculator';
import { F } from '../../utils';
import { Result, failure, success } from '../../utils/results';
import { createOrUpdate, getByProgramId } from './repo';

const L = loggerFor(__filename);
type UpdateResult = {
	donorsUnchanged: string[];
	donorsUnchangedCount: number;
	isDryRun: boolean;
};

type CreateResult = UpdateResult & {
	donorsAdded: string[];
	donorsAddedCount: number;
};

type DeleteResult = UpdateResult & {
	donorsDeleted: string[];
	donorsDeletedCount: number;
};

/**
 * Creates or updates (if exists) donor submitter id missing exception in the database.
 * With dry run set to true, reports summary of changes but makes no updates.
 *
 * @param input Submitter donor ids, a program id and a boolean on whether this request is a dry run.
 * @returns  Details of of the operation result including a list and count of changes and unchanged ids.
 */
export const create = async ({
	programId,
	newDonorIds,
	isDryRun,
}: {
	programId: string;
	newDonorIds: string[];
	isDryRun: boolean;
}): Promise<Result<CreateResult>> => {
	const missingEntityExceptionResult = await getByProgramId(programId);

	if (missingEntityExceptionResult.success) {
		const currentDonorIds = missingEntityExceptionResult.data.donorSubmitterIds;

		// return unique donor ids
		const donorSubmitterIds = [...new Set([...currentDonorIds, ...newDonorIds])];

		// calc new and unchanged ids
		const donorsAdded = newDonorIds.filter((id) => !currentDonorIds.includes(id));
		const donorsUnchanged = newDonorIds.filter((id) => currentDonorIds.includes(id));

		const stats: CreateResult = {
			donorsAdded,
			donorsAddedCount: donorsAdded.length,
			donorsUnchanged,
			donorsUnchangedCount: donorsUnchanged.length,
			isDryRun,
		};

		if (isDryRun) {
			return success(stats);
		} else {
			const result = await createOrUpdate({ programId, donorSubmitterIds });
			if (result.success) {
				// Intentionally no await here:
				// We want this to run asynchronously after we return a response for this request. Consider this a post processing step.
				recalculateAndUpdateDonors({
					donorSubmitterIds: newDonorIds,
					programId,
				});

				return success(stats);
			} else {
				return result;
			}
		}
	} else {
		return missingEntityExceptionResult;
	}
};

export const deleteIdsByProgramId = async ({
	programId,
	donorSubmitterIds,
	isDryRun,
}: {
	programId: string;
	donorSubmitterIds: string[];
	isDryRun: boolean;
}): Promise<Result<DeleteResult>> => {
	const missingEntityExceptionResult = await getByProgramId(programId);
	if (missingEntityExceptionResult.success) {
		const currentDonorIds = missingEntityExceptionResult.data.donorSubmitterIds;
		const updatedDonorIds = currentDonorIds.filter((id) => !donorSubmitterIds.includes(id));

		// calc deleted and unchanged ids
		const donorsDeleted = donorSubmitterIds.filter((id) => currentDonorIds.includes(id));
		const donorsUnchanged = currentDonorIds.filter((id) => !donorSubmitterIds.includes(id));
		const stats: DeleteResult = {
			donorsDeleted,
			donorsDeletedCount: donorsDeleted.length,
			donorsUnchanged,
			donorsUnchangedCount: donorsUnchanged.length,
			isDryRun,
		};

		if (isDryRun) {
			return success(stats);
		} else {
			const result = await createOrUpdate({ programId, donorSubmitterIds: updatedDonorIds });
			if (result.success) {
				return success(stats);
			} else {
				return result;
			}
		}
	} else {
		return missingEntityExceptionResult;
	}
};

const recalculateAndUpdateDonors = async (props: {
	donorSubmitterIds: string[];
	programId: string;
}): Promise<Result<DeepReadonly<Donor>[]>> => {
	try {
		const donorDocuments = await donorRepo.findByProgramAndSubmitterIds(
			props.programId,
			props.donorSubmitterIds,
		);
		const updatedDonors = await updateDonorsCompletionStats(
			(donorDocuments || []) as DeepReadonly<Donor>[],
		);
		const savedDonors = await donorRepo.updateAll(updatedDonors.map((dto) => F(dto)));
		return success(savedDonors);
	} catch (error) {
		const message = 'Error thrown while updating donor core completion data';
		L.error(message, error);
		return failure(message, error);
	}
};
