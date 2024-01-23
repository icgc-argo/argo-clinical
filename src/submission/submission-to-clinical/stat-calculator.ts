/*
 * Copyright (c) 2023 The Ontario Institute for Cancer Research. All rights reserved
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

import { F } from '../../../src/utils';
import { CompletionStats, CoreCompletionFields, Donor } from '../../clinical/clinical-entities';
import { ClinicalEntitySchemaNames } from '../../common-model/entities';
import {
	calculateSpecimenCompletionStats,
	filterHasDnaSample,
	getClinicalEntitiesFromDonorBySchemaName,
} from '../../common-model/functions';
import { DeepReadonly } from 'deep-freeze';
import { cloneDeep, cloneDeepWith, mean, omit, uniq } from 'lodash';
import * as missingEntityExceptionRepo from '../../exception/missing-entity-exceptions/repo';

type ForceRecaculateFlags = {
	recalcEvenIfComplete?: boolean; // used to force recalculate if stat is already 100%
	recalcEvenIfOverridden?: boolean; // used to force recalculate if previously overriden
};

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
 * Re-calculate core-completion stats for each provided donor. Will return a new array with an updated
 * copy of each donor which includes the latest completion stats.
 *
 * This function retrieves missing-entity exception data in order to use this exception information when
 * calculating core completion stats.
 * @param donors
 */
export const updateDonorsCompletionStats = async (
	donors: (Donor | Readonly<Donor>)[],
): Promise<Donor[]> => {
	// Cache program exceptions so we don't need to repeatedly fetch them
	const programExceptionData: Record<string, string[]> = {};
	const getProgramExceptionDonors = async (programId: string): Promise<string[]> => {
		if (programExceptionData[programId]) {
			return programExceptionData[programId];
		}

		const programExceptionResult = await missingEntityExceptionRepo.getByProgramId(programId);
		const programException = programExceptionResult.success
			? programExceptionResult.data.donorSubmitterIds
			: [];

		programExceptionData[programId] = programException;

		return programException;
	};

	const updatedDonorPromises = donors.map(async (donor) => {
		const clonedDonor = cloneDeep(donor) as Donor;
		const hasException = (await getProgramExceptionDonors(clonedDonor.programId)).some(
			(submitterId) => submitterId === clonedDonor.submitterId,
		);
		const completionStats = calculateDonorCoreCompletionStats(clonedDonor, hasException);
		clonedDonor.completionStats = completionStats;
		return clonedDonor;
	});
	const updatedDonors = await Promise.all(updatedDonorPromises).then((values) => values);

	return updatedDonors;
};

/**
 * Calculation of core-completion state for the donor.
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
	let newCompletionStats: CompletionStats = donor.completionStats
		? cloneDeep(donor.completionStats)
		: getEmptyCoreStats();

	// update completion state for each core entity
	Array.from(coreClinicalSchemaNamesSet).forEach((clinicalType) => {
		if (clinicalType === ClinicalEntitySchemaNames.SPECIMEN) {
			// Specimen completion calculation requires performing counting of DNA samples only
			const filteredDonorSpecimens = donor.specimens.filter(filterHasDnaSample);

			const { coreCompletionPercentage } = calculateSpecimenCompletionStats(filteredDonorSpecimens);

			const statsPropertyName = schemaNameToCoreCompletenessStat[clinicalType];
			newCompletionStats.coreCompletion[statsPropertyName] = coreCompletionPercentage;
		} else {
			// for others we just need to find one clinical info for core entity
			const entities = getClinicalEntitiesFromDonorBySchemaName(donor, clinicalType);

			const statsPropertyName = schemaNameToCoreCompletenessStat[clinicalType];
			newCompletionStats.coreCompletion[statsPropertyName] = entities.length >= 1 ? 1 : 0;
		}
	});

	const currentCompletionPecentage = donor.completionStats?.coreCompletionPercentage;

	// Don't update core completion if its already complete.
	const coreCompletionPercentage =
		currentCompletionPecentage === 1
			? 1
			: getCoreCompletionPercentage(newCompletionStats.coreCompletion, hasMissingEntityException);

	const coreCompletionDate = getCoreCompletionDate(donor, newCompletionStats);

	newCompletionStats = {
		...newCompletionStats,
		coreCompletionPercentage,
		coreCompletionDate,
	};

	return newCompletionStats;
};

export const recalculateDonorStatsHoldOverridden = (donor: Donor) => {
	const updatedDonor = calculateDonorCoreCompletionStats(donor, {
		recalcEvenIfComplete: true,
		recalcEvenIfOverridden: false,
	});

	// extended stats
	return updatedDonor;
};

export const updateDonorStatsFromRegistrationCommit = (donor: DeepReadonly<Donor>) => {
	// no aggregated info so donor has no clinical submission, nothing to calculate
	if (!donor.completionStats) return donor;

	// specimen core stats can change from sample registration when specimens are added
	const updatedDonor = calculateDonorCoreCompletionStats(donor, {
		recalcEvenIfComplete: true,
		recalcEvenIfOverridden: true,
	});

	return F(updatedDonor);
};

export const updateDonorStatsFromSubmissionCommit = (
	donor: Donor,
	clinicalType: ClinicalEntitySchemaNames,
) => {
	// registration has no buisness here
	if (clinicalType === ClinicalEntitySchemaNames.REGISTRATION) return;

	let updatedDonor = donor;

	if (isCoreEntitySchemaName(clinicalType)) {
		updatedDonor = calculateDonorCoreCompletionStats(donor, {
			recalcEvenIfComplete: false,
			recalcEvenIfOverridden: true,
		});
	}

	return updatedDonor;
};

const isCoreEntitySchemaName = (clinicalType: string): clinicalType is CoreClinicalSchemaName =>
	coreClinicalSchemaNamesSet.has(clinicalType as CoreClinicalSchemaName);

function noNeedToCalcCoreStat(
	donor: Donor,
	clinicalType: CoreClinicalSchemaName,
	forceFlags: ForceRecaculateFlags,
) {
	// if recalculate overridden, need to ignore completion value since overridden value could be 100%
	if (forceFlags.recalcEvenIfOverridden && !forceFlags.recalcEvenIfComplete) {
		return false;
	}

	// if entity was manually overridden, don't recalculate (might set to undesired value)
	if (
		!forceFlags.recalcEvenIfOverridden &&
		donor.completionStats?.overriddenCoreCompletion?.find(
			(type) => type === schemaNameToCoreCompletenessStat[clinicalType],
		)
	) {
		return true;
	}

	// if entity is already core complete it can't become uncomplete since records can't be deleted
	// only exception is if specimens are added
	if (
		!forceFlags.recalcEvenIfComplete &&
		(donor.completionStats?.coreCompletion || {})[
			schemaNameToCoreCompletenessStat[clinicalType]
		] === 1
	) {
		return true;
	}
	return false;
}
