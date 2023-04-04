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

import {
  CoreClinicalEntities,
  CoreCompletionFields,
  Donor,
} from '../../clinical/clinical-entities';
import { ClinicalEntitySchemaNames } from '../../common-model/entities';
import { F } from '../../../src/utils';
import {
  calculateSpecimenCompletionStats,
  dnaSampleFilter,
  getClinicalEntitiesFromDonorBySchemaName,
} from '../../common-model/functions';

import { DeepReadonly } from 'deep-freeze';
import { cloneDeep, mean, pull } from 'lodash';

type ForceRecaculateFlags = {
  recalcEvenIfComplete?: boolean; // used to force recalculate if stat is already 100%
  recalcEvenIfOverriden?: boolean; // used to force recalculate if previously overriden
};

type CoreClinicalSchemaName =
  | ClinicalEntitySchemaNames.DONOR
  | ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS
  | ClinicalEntitySchemaNames.TREATMENT
  | ClinicalEntitySchemaNames.FOLLOW_UP
  | ClinicalEntitySchemaNames.SPECIMEN;

const getCoreCompletionPercentage = (fields: CoreCompletionFields) =>
  mean(Object.values(fields || {})) || 0;

const getCoreCompletionDate = (donor: Donor, percentage: number) =>
  percentage === 1
    ? donor.completionStats?.coreCompletionDate || donor.updatedAt || new Date().toDateString()
    : undefined;

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

// This is the main core stat caclulation function.
// We consider only `required & core` fields for core field calculation, which are always submitted.
// Additionally, `optional & core` fields are submitted in relation to `required & core` fields,
// which are verified at upload/data-validate step. So can assume record is valid.

// This function is referenced in the recalculate-core-completion migration file,
// Any code updates should validate that migration is unaffected
const calcDonorCoreEntityStats = (
  donor: Donor,
  clinicalType: CoreClinicalSchemaName,
  forceFlags: ForceRecaculateFlags, // used to control recalculate under certain conditions
) => {
  if (noNeedToCalcCoreStat(donor, clinicalType, forceFlags)) return;

  const coreStats = cloneDeep(donor.completionStats?.coreCompletion) || getEmptyCoreStats();

  if (clinicalType === ClinicalEntitySchemaNames.SPECIMEN) {
    const filteredDonorSpecimens = donor.specimens.filter(dnaSampleFilter);

    const { coreCompletionPercentage } = calculateSpecimenCompletionStats(filteredDonorSpecimens);

    coreStats[schemaNameToCoreCompletenessStat[clinicalType]] = coreCompletionPercentage;
  } else {
    // for others we just need to find one clinical info for core entity
    const entities = getClinicalEntitiesFromDonorBySchemaName(donor, clinicalType);
    coreStats[schemaNameToCoreCompletenessStat[clinicalType]] = entities.length >= 1 ? 1 : 0;
  }

  const coreCompletionPercentage = getCoreCompletionPercentage(coreStats);
  const coreCompletionDate = getCoreCompletionDate(donor, coreCompletionPercentage);

  donor.completionStats = {
    ...donor.completionStats,
    coreCompletion: coreStats,
    coreCompletionDate,
    coreCompletionPercentage,
    overriddenCoreCompletion: pull(
      donor.completionStats?.overriddenCoreCompletion || [],
      schemaNameToCoreCompletenessStat[clinicalType],
    ),
  };
};

export const recalculateDonorStatsHoldOverridden = (donor: Donor) => {
  coreClinicalSchemaNamesSet.forEach(type =>
    calcDonorCoreEntityStats(donor, type, {
      recalcEvenIfComplete: true,
      recalcEvenIfOverriden: false,
    }),
  );
  // extended stats
  return donor;
};

export const updateDonorStatsFromRegistrationCommit = (donor: DeepReadonly<Donor>) => {
  // no aggreagated info so donor has no clinical submission, nothing to calculate
  if (!donor.completionStats) return donor;

  const mutableDonor = cloneDeep(donor) as Donor;

  // specimen core stats can change from sample registration when specimens are added
  calcDonorCoreEntityStats(mutableDonor, ClinicalEntitySchemaNames.SPECIMEN, {
    recalcEvenIfComplete: true,
    recalcEvenIfOverriden: true,
  });

  // other entites that need to be updated from registration commit here...

  return F(mutableDonor);
};

export const updateDonorStatsFromSubmissionCommit = (
  donor: Donor,
  clinicalType: ClinicalEntitySchemaNames,
) => {
  // registration has no buisness here
  if (clinicalType === ClinicalEntitySchemaNames.REGISTRATION) return;

  if (isCoreEntitySchemaName(clinicalType)) {
    // if donor is invalid don't recalculate, just remove from overriden, will be fully recalculated once it becomes valid
    if (!donor.schemaMetadata.isValid) {
      removeEntityFromOverridenCore(donor, clinicalType);
      return;
    }
    calcDonorCoreEntityStats(donor, clinicalType as CoreClinicalSchemaName, {
      recalcEvenIfComplete: false,
      recalcEvenIfOverriden: true,
    });
  }
};

// This function is referenced in the recalculate-core-completion migration file,
// Any code updates should validate that migration is unaffected
export const forceRecalcDonorCoreEntityStats = (
  donor: DeepReadonly<Donor>,
  coreStatOverride: any = {},
) => {
  if (!isValidCoreStatOverride(coreStatOverride)) {
    throw new Error(`Invalid coreStatOverride`);
  }

  const donorUpdated = cloneDeep(donor) as Donor;

  coreClinicalSchemaNamesSet.forEach(type =>
    calcDonorCoreEntityStats(donorUpdated, type as CoreClinicalSchemaName, {
      recalcEvenIfComplete: true,
      recalcEvenIfOverriden: true,
    }),
  );

  const newCoreCompletion = {
    ...donorUpdated.completionStats?.coreCompletion, // set recalculated core completion
    ...coreStatOverride, // merge coreStatOverride
  };

  const coreCompletionPercentage = getCoreCompletionPercentage(newCoreCompletion);
  const coreCompletionDate = getCoreCompletionDate(donorUpdated, coreCompletionPercentage);

  donorUpdated.completionStats = {
    ...donorUpdated.completionStats,
    coreCompletion: newCoreCompletion,
    coreCompletionDate,
    coreCompletionPercentage,
    overriddenCoreCompletion: Object.keys(coreStatOverride || {}) as CoreClinicalEntities[],
  };

  return donorUpdated;
};

// currently invalid core entities are set to zero
export const setInvalidCoreEntityStatsForMigration = (
  donor: DeepReadonly<Donor>,
  invalidEntities: string[],
) => {
  const mutableDonor = cloneDeep(donor) as Donor;

  const overriddenCoreEntities = mutableDonor.completionStats?.overriddenCoreCompletion || [];
  const coreCompletion = mutableDonor.completionStats?.coreCompletion || getEmptyCoreStats();

  invalidEntities.filter(isCoreEntitySchemaName).forEach(coreEntity => {
    coreCompletion[schemaNameToCoreCompletenessStat[coreEntity]] = 0;
    pull(overriddenCoreEntities, schemaNameToCoreCompletenessStat[coreEntity]);
  });

  const coreCompletionPercentage = getCoreCompletionPercentage(coreCompletion);
  const coreCompletionDate = getCoreCompletionDate(mutableDonor, coreCompletionPercentage);

  mutableDonor.completionStats = {
    ...mutableDonor.completionStats,
    coreCompletion,
    coreCompletionDate,
    coreCompletionPercentage,
    overriddenCoreCompletion: overriddenCoreEntities,
  };
  return mutableDonor;
};

const getEmptyCoreStats = (): CoreCompletionFields => {
  return cloneDeep({
    donor: 0,
    specimens: 0,
    primaryDiagnosis: 0,
    followUps: 0,
    treatments: 0,
  });
};

const isCoreEntitySchemaName = (clinicalType: string): clinicalType is CoreClinicalSchemaName =>
  coreClinicalSchemaNamesSet.has(clinicalType as CoreClinicalSchemaName);

function noNeedToCalcCoreStat(
  donor: Donor,
  clinicalType: CoreClinicalSchemaName,
  forceFlags: ForceRecaculateFlags,
) {
  // if recalculate ovveriden, need to ignore completion value since overriden value could be 100%
  if (forceFlags.recalcEvenIfOverriden && !forceFlags.recalcEvenIfComplete) {
    return false;
  }

  // if entity was manually overriden, don't recalculate (might set to undesired value)
  if (
    !forceFlags.recalcEvenIfOverriden &&
    donor.completionStats?.overriddenCoreCompletion.find(
      type => type === schemaNameToCoreCompletenessStat[clinicalType],
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

function isValidCoreStatOverride(
  updatedCompletion: any,
): updatedCompletion is CoreCompletionFields {
  return Object.entries(updatedCompletion).every(
    ([type, val]) =>
      Object.values(schemaNameToCoreCompletenessStat).find(field => type === field) &&
      typeof val === 'number' &&
      val >= 0 &&
      val <= 1,
  );
}

function removeEntityFromOverridenCore(donor: Donor, clinicalType: CoreClinicalSchemaName) {
  pull(
    donor.completionStats?.overriddenCoreCompletion || [],
    schemaNameToCoreCompletenessStat[clinicalType],
  );
}
