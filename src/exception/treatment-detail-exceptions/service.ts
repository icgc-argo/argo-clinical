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

import { loggerFor } from '../../logger';
import { AsyncResult, Result, success, failure } from '../../utils/results';
import { CreateResult, DeleteResult } from '../common';
import { TreatmentDetailException } from './model';
import { createOrUpdate, getByProgramId } from './repo';

const L = loggerFor(__filename);

/**
 * Creates or updates (if exists) donor submitter ids for treat detail exception in the database.
 * With dry run set to true, reports summary of changes but makes no updates.
 *
 * @param input Submitter donor ids, a program id and a boolean on whether this request is a dry run.
 * @returns  Details of the operation result including a list and count of changes and unchanged ids.
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
	const treatmentDetailExceptionResult = await getByProgramId(programId);

	if (treatmentDetailExceptionResult.success) {
		const currentDonorIds = treatmentDetailExceptionResult.data.donorSubmitterIds;

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
				return success(stats);
			} else {
				return result;
			}
		}
	} else {
		return treatmentDetailExceptionResult;
	}
};

export const getTreatmentDetailException = async ({
	programId,
}: {
	programId: string;
}): AsyncResult<TreatmentDetailException> => {
	const result = await getByProgramId(programId);
	return result.success ? result : failure(`Cannot find program exceptions for ${programId}`);
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
	const treatmentDetailExceptionResult = await getByProgramId(programId);
	if (treatmentDetailExceptionResult.success) {
		const currentDonorIds = treatmentDetailExceptionResult.data.donorSubmitterIds;
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
		return treatmentDetailExceptionResult;
	}
};
