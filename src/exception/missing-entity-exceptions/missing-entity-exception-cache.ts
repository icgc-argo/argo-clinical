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
import * as missingEntityExceptionRepo from '../../exception/missing-entity-exceptions/repo';

/**
 * Creates a short lived caching object that will store missing entity exceptions hashed by programId.
 * This provides access to the MissingEntityExceptions stored in the database with caching by programId
 * so that many donors can be checked for exceptions without having to make repeated database queries.
 *
 * It is built for use with the `stat-calculator.ts` function `updateSingleDonorCompletionStats`.
 *
 * @example
 * ```
 * const cache = createMissingEntityExceptionCache();
 *
 * // will fetch exceptions for program, or return cached list.
 * const programDonorsWithException = await cache.getProgramExceptionDonors(someProgramId);
 *
 * // boolean value indicating if a donor has an exception, checked against cache
 * const donorHasMissingEntityException = await cache.donorHasException(donor);
 * ```
 *
 * @returns
 */
export const createMissingEntityExceptionCache = () => {
	const programExceptionData: Map<string, string[]> = new Map();

	/**
	 * Retrieve list of submitterDonorIds that have the MissingEntityException for a specific program
	 * @param programId
	 * @returns
	 */
	const getProgramExceptionDonors = async (programId: string): Promise<string[]> => {
		const programData = programExceptionData.get(programId);
		if (programData) {
			return programData;
		}

		const programExceptionResult = await missingEntityExceptionRepo.getByProgramId(programId);
		const programException = programExceptionResult.success
			? programExceptionResult.data.donorSubmitterIds
			: [];

		programExceptionData.set(programId, programException);

		return programException;
	};

	/**
	 * Determine if a donor has a MissingEntityException, checking vs the cache if possible or fetching from the database.
	 * @param donor
	 * @returns
	 */
	const donorHasException = async (donor: Donor | DeepReadonly<Donor>): Promise<boolean> =>
		(await getProgramExceptionDonors(donor.programId)).some(
			(submitterId) => submitterId === donor.submitterId,
		);

	return { data: programExceptionData, donorHasException, getProgramExceptionDonors };
};

/**
 * Object to handle fetching MissingEntityExceptions. Will allow multiple retrievals of
 * MissingEntityException for a program without repeat requests to the database for the same program.
 *
 * For more details on usage and to create a cache see `createMissingEntityExceptionCache`.
 */
export type MissingEntityExceptionCache = ReturnType<typeof createMissingEntityExceptionCache>;
