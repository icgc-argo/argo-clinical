/*
 * Copyright (c) 2025 The Ontario Institute for Cancer Research. All rights reserved
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
import * as singleSpecimenExceptionRepo from './repo';

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
export const createSingleSpecimenExceptionCache = () => {
	let singleSpecimenExceptions: string[] | undefined = undefined;

	/**
	 * Retrieve list of submitterDonorIds that have the MissingEntityException for a specific program
	 * @param programId
	 * @returns
	 */
	const getSingleSpecimenProgramIds = async (): Promise<string[]> => {
		if (singleSpecimenExceptions) {
			return singleSpecimenExceptions;
		}

		const result = await singleSpecimenExceptionRepo.getExceptions();
		singleSpecimenExceptions = result.success ? result.data : [];

		return singleSpecimenExceptions;
	};

	/**
	 * Determine if a donor has a SingleSpecimenException, checking vs the cache if possible or fetching from the database.
	 * @param donor
	 * @returns boolean
	 */
	const donorHasException = async (donor: Donor | DeepReadonly<Donor>): Promise<boolean> =>
		(await getSingleSpecimenProgramIds()).some((programId) => programId === donor.programId);

	return { donorHasException };
};

/**
 * Object to handle fetching SingleSpecimenExceptions. Will allow multiple retrievals of
 * SingleSpecimenException for a program without repeat requests to the database.
 *
 * For more details on usage and to create a cache see `createSingleSpecimenExceptionCache`.
 */
export type SingleSpecimenExceptionCache = ReturnType<typeof createSingleSpecimenExceptionCache>;
