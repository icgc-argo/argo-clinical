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
import { cloneDeep, mean, omit } from 'lodash';
import { CompletionStats, CoreCompletionFields, Donor } from '../../clinical/clinical-entities';
import { ClinicalEntitySchemaNames } from '../../common-model/entities';
import {
	calculateSpecimenCompletionStats,
	filterHasDnaSample,
	getClinicalEntitiesFromDonorBySchemaName,
} from '../../common-model/functions';

import {
	MissingEntityExceptionCache,
	createMissingEntityExceptionCache,
} from '../../exception/missing-entity-exceptions/missing-entity-exception-cache';

type CoreClinicalSchemaName =
	| ClinicalEntitySchemaNames.DONOR
	| ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS
	| ClinicalEntitySchemaNames.TREATMENT
	| ClinicalEntitySchemaNames.FOLLOW_UP
	| ClinicalEntitySchemaNames.SPECIMEN;

/**
 * Calculate the core completion percentage for a donor.
 * This is a value from 0-1 that represents what percentage of the required core entities have been submitted for this donor.
 *
 * If the user has a missing-entity exception then they will not require Treatments or Follow Up entities, so their percentage
 * will be calculated vs 3 required entities instead of the normal 5.
 *
 * @param fields
 * @param hasMissingEntityException
 * @returns
 */
const getCoreCompletionPercentage = (
	fields: CoreCompletionFields,
	hasMissingEntityException: boolean,
): number => {
	const requiredFields = hasMissingEntityException
		? omit(fields, 'treatments', 'followUps')
		: fields;

	return mean(Object.values(requiredFields)) || 0;
};

const getCoreCompletionDate = (donor: Donor, coreCompletionStats: CompletionStats) =>
	coreCompletionStats.coreCompletionPercentage === 1
		? coreCompletionStats.coreCompletionDate || donor.updatedAt || new Date().toDateString()
		: undefined;

/**
 * Map from entity schema names to the property names of Core Completion Stats
 */
const schemaNameToCoreCompletenessStat: Record<
	CoreClinicalSchemaName,
	keyof CoreCompletionFields
> = {
	[ClinicalEntitySchemaNames.DONOR]: 'donor',
	[ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]: 'primaryDiagnosis',
	[ClinicalEntitySchemaNames.TREATMENT]: 'treatments',
	[ClinicalEntitySchemaNames.FOLLOW_UP]: 'followUps',
	[ClinicalEntitySchemaNames.SPECIMEN]: 'specimens',
};

const coreClinicalSchemaNamesSet = new Set<CoreClinicalSchemaName>(
	Object.keys(schemaNameToCoreCompletenessStat) as CoreClinicalSchemaName[],
);

const getEmptyCoreStats = (): CompletionStats => ({
	coreCompletion: {
		donor: 0,
		specimens: 0,
		primaryDiagnosis: 0,
		followUps: 0,
		treatments: 0,
	},
	coreCompletionPercentage: 0,
});

/**
 * Main calculation logic for core-completion state for the donor.
 *
 * If the donor has an exception allowing some core entities to be missing, that must be provided in the function arguments.
 * This will excuse the donor from requiring a treatment or followup entity to be core complete.
 *
 * A donor that is marked core-complete (coreCompletionPercentage === 1) cannot lose the complete status.
 * The individual core entities will still be calculated so the current list of complete entities for this donor will still be known.
 *
 * @param donor
 * @param hasMissingEntityException - Indicates if this donor has been given an exception to allow it to be core complete while missing select core entities
 * @returns
 */
export const calculateDonorCoreCompletionStats = (
	donor: Donor,
	hasMissingEntityException: boolean,
): CompletionStats => {
	const updatedCompletionStats: CompletionStats = donor.completionStats
		? cloneDeep(donor.completionStats)
		: getEmptyCoreStats();

	updatedCompletionStats.hasMissingEntityException = hasMissingEntityException;

	// update completion state for each core entity
	Array.from(coreClinicalSchemaNamesSet).forEach((clinicalType) => {
		if (clinicalType === ClinicalEntitySchemaNames.SPECIMEN) {
			// Specimen completion calculation requires performing counting of DNA samples only
			const filteredDonorSpecimens = donor.specimens.filter(filterHasDnaSample);

			const { coreCompletionPercentage } = calculateSpecimenCompletionStats(filteredDonorSpecimens);

			const statsPropertyName = schemaNameToCoreCompletenessStat[clinicalType];
			updatedCompletionStats.coreCompletion[statsPropertyName] = coreCompletionPercentage;
		} else {
			// for others we just need to find one clinical info for core entity
			const entities = getClinicalEntitiesFromDonorBySchemaName(donor, clinicalType);

			const statsPropertyName = schemaNameToCoreCompletenessStat[clinicalType];
			updatedCompletionStats.coreCompletion[statsPropertyName] = entities.length >= 1 ? 1 : 0;
		}
	});

	// Don't update core completion if its already complete.
	updatedCompletionStats.coreCompletionPercentage =
		donor.completionStats?.coreCompletionPercentage === 1
			? 1
			: getCoreCompletionPercentage(
					updatedCompletionStats.coreCompletion,
					hasMissingEntityException,
			  );

	updatedCompletionStats.coreCompletionDate = getCoreCompletionDate(donor, updatedCompletionStats);

	return updatedCompletionStats;
};

/**
 * Re-calculate the completion stats for a single donor. Will return a cloned version of the donor
 * with updated completion stats.
 *
 * If you have an array of donors that all need updating, it may be simpler to use `updateDonorsCompletionStats`
 * instead of looping this function.
 *
 * This function requires an exceptionsCache object. This is a performance optimization to prevent repeated calls
 * to the database when looping over large numbers of donors from the same program. See the example for how to
 * set this up.
 *
 *
 * @example
 * ```ts
 * import {
 * 	createMissingEntityExceptionCache,
 * } from './exception/missing-entity-exceptions/missing-entity-exception-cache';
 *
 * const donor: Donor = await someFunctionThatReturnsADonor();
 * const exceptionsCache = createMissingEntityExceptionCache();
 *
 * const updatedDonor = await updateSingleDonorCompletionStats(donor, exceptionsCache);
 * ```
 *
 * @param donor
 * @param exceptionsCache
 * @returns
 */
export const updateSingleDonorCompletionStats = async (
	donor: Donor | DeepReadonly<Donor>,
	exceptionsCache: MissingEntityExceptionCache,
): Promise<Donor> => {
	const clonedDonor = cloneDeep(donor) as Donor;

	const hasException = await exceptionsCache.donorHasException(clonedDonor);

	const completionStats = calculateDonorCoreCompletionStats(clonedDonor, hasException);
	clonedDonor.completionStats = completionStats;
	return clonedDonor;
};

/**
 * Re-calculate core-completion stats for each provided donor. Will return a new array with an updated
 * copy of each donor which includes the latest completion stats.
 *
 * Does not save to DB.
 *
 * This function retrieves missing-entity exception data in order to use this exception information when
 * calculating core completion stats.
 * @param donors
 */
export const updateDonorsCompletionStats = async (
	donors: (Donor | DeepReadonly<Donor>)[],
): Promise<Donor[]> => {
	// Cache program exceptions so we don't need to repeatedly fetch them
	const exceptionsCache = await createMissingEntityExceptionCache();

	// clone each donor
	const updatedDonorPromises = donors.map(
		async (donor) => await updateSingleDonorCompletionStats(donor, exceptionsCache),
	);
	const updatedDonors = await Promise.all(updatedDonorPromises).then((values) => values);

	return updatedDonors;
};
