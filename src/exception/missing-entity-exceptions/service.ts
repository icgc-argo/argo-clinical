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

import { Result, failure, success } from '../../utils/results';
import { createOrUpdate, getByProgramId } from './repo';

type CreateResponse = {
	donorsAdded: string[];
	donorsAddedCount: number;
	donorsUnchanged: string[];
	donorsUnchangedCount: number;
};

export const create = async ({
	programId,
	newDonorIds,
	isDryRun,
}: {
	programId: string;
	newDonorIds: string[];
	isDryRun: boolean;
}): Promise<Result<CreateResponse>> => {
	const missingEntityExceptionResult = await getByProgramId(programId);

	if (missingEntityExceptionResult.success) {
		const currentDonorIds = missingEntityExceptionResult.exception.donorSubmitterIds;

		// return unique donor ids
		const donorSubmitterIds = [...new Set([...currentDonorIds, ...newDonorIds])];

		// calc new and updated ids
		const donorsAdded = donorSubmitterIds.filter((id) => !currentDonorIds.includes(id));
		const donorsUnchanged = donorSubmitterIds.filter((id) => currentDonorIds.includes(id));

		const stats = {
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
		return missingEntityExceptionResult;
	}
};
