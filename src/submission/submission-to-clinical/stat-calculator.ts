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
  CompletionStats,
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
import { cloneDeep, mean } from 'lodash';

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

const getEmptyCoreStats = (): CompletionStats =>
  cloneDeep({
    coreCompletion: {
      donor: 0,
      specimens: 0,
      primaryDiagnosis: 0,
      followUps: 0,
      treatments: 0,
    },
    coreCompletionPercentage: 0,
  });

// This is the main core stat calculation function.
// We consider only `required & core` fields for core field calculation, which are always submitted.

// Additionally, `optional & core` fields are submitted in relation to `required & core` fields,
// which are verified at upload/data-validate step. Validation and completion are calculated separately.

// This function is referenced in the recalculate-core-completion migration file.
// Any code updates should validate that migration is unaffected.
export const calcDonorCoreEntityStats = (
  donor: Donor,
  forceFlags: ForceRecaculateFlags, // used to control recalculate under certain conditions
) => {
  const updatedDonor = cloneDeep(donor);

  let newCompletionStats = donor.completionStats
    ? { ...donor.completionStats }
    : getEmptyCoreStats();
  const coreStats = newCompletionStats.coreCompletion;

  const updatedEntities = Array.from(coreClinicalSchemaNamesSet).filter(
    (clinicalType: CoreClinicalSchemaName) =>
      !noNeedToCalcCoreStat(updatedDonor, clinicalType, forceFlags),
  );

  updatedEntities.forEach(clinicalType => {
    if (clinicalType === ClinicalEntitySchemaNames.SPECIMEN) {
      const filteredDonorSpecimens = donor.specimens.filter(dnaSampleFilter);

      const { coreCompletionPercentage } = calculateSpecimenCompletionStats(filteredDonorSpecimens);

      coreStats[schemaNameToCoreCompletenessStat[clinicalType]] = coreCompletionPercentage;
    } else {
      // for others we just need to find one clinical info for core entity
      const entities = getClinicalEntitiesFromDonorBySchemaName(donor, clinicalType);

      coreStats[schemaNameToCoreCompletenessStat[clinicalType]] = entities.length >= 1 ? 1 : 0;
    }
  });

  const coreCompletionPercentage = getCoreCompletionPercentage(coreStats);
  const coreCompletionDate = getCoreCompletionDate(
    updatedDonor,
    newCompletionStats.coreCompletionPercentage,
  );

  newCompletionStats = {
    ...newCompletionStats,
    coreCompletion: coreStats,
    coreCompletionPercentage,
    coreCompletionDate,
  };

  updatedDonor.completionStats = newCompletionStats;

  return updatedDonor;
};

export const recalculateDonorStatsHoldOverridden = (donor: Donor) => {
  const updatedDonor = calcDonorCoreEntityStats(donor, {
    recalcEvenIfComplete: true,
    recalcEvenIfOverridden: false,
  });

  // extended stats
  return updatedDonor;
};

export const updateDonorStatsFromRegistrationCommit = (donor: DeepReadonly<Donor>) => {
  // no aggreagated info so donor has no clinical submission, nothing to calculate
  if (!donor.completionStats) return donor;

  const mutableDonor = cloneDeep(donor) as Donor;

  // specimen core stats can change from sample registration when specimens are added
  const updatedDonor = calcDonorCoreEntityStats(mutableDonor, {
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

  let updatedDonor = cloneDeep(donor);

  if (isCoreEntitySchemaName(clinicalType)) {
    updatedDonor = calcDonorCoreEntityStats(donor, {
      recalcEvenIfComplete: false,
      recalcEvenIfOverridden: true,
    });
  }

  return updatedDonor;
};

export const patchCoreCompletionWithOverride = (
  donor: DeepReadonly<Donor>,
  coreStatOverride: any = {},
) => {
  if (!isValidCoreStatOverride(coreStatOverride)) {
    throw new Error(`Invalid coreStatOverride`);
  }

  const donorClone = cloneDeep(donor) as Donor;

  const updatedDonor = calcDonorCoreEntityStats(donorClone, {
    recalcEvenIfComplete: true,
    recalcEvenIfOverridden: true,
  });

  const newCoreCompletion = {
    ...updatedDonor.completionStats?.coreCompletion, // set recalculated core completion
    ...coreStatOverride, // merge coreStatOverride
  };

  const coreCompletionPercentage = getCoreCompletionPercentage(newCoreCompletion);
  const coreCompletionDate = getCoreCompletionDate(updatedDonor, coreCompletionPercentage);

  updatedDonor.completionStats = {
    ...updatedDonor.completionStats,
    coreCompletion: newCoreCompletion,
    coreCompletionDate,
    coreCompletionPercentage,
    overriddenCoreCompletion: Object.keys(coreStatOverride || {}) as CoreClinicalEntities[],
  };

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
