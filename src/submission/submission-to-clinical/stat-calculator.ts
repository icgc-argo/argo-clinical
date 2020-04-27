import {
  Donor,
  CoreCompletionStats,
  CoreClinicalEntites,
} from '../../../src/clinical/clinical-entities';
import { ClinicalEntitySchemaNames } from '../submission-entities';
import { notEmpty, F } from '../../../src/utils';

import { getClinicalEntitiesFromDonorBySchemaName } from './submission-to-clinical';
import { DeepReadonly } from 'deep-freeze';
import { cloneDeep, pull, includes } from 'lodash';
import { isNumber } from 'util';

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

const schemaNameToCoreCompletenessStat: Record<
  CoreClinicalSchemaName,
  keyof CoreCompletionStats
> = {
  [ClinicalEntitySchemaNames.DONOR]: 'donor',
  [ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]: 'primaryDiagnosis',
  [ClinicalEntitySchemaNames.TREATMENT]: 'treatments',
  [ClinicalEntitySchemaNames.FOLLOW_UP]: 'followUps',
  [ClinicalEntitySchemaNames.SPECIMEN]: 'specimens',
};

const coreClinialSchemaNamesSet = new Set<CoreClinicalSchemaName>(
  Object.keys(schemaNameToCoreCompletenessStat) as CoreClinicalSchemaName[],
);

// This is the main core stat caclulation function.
// We conisder only `required & core` fields for core field calculation, which are always submitted.
// Additionally, `optional & core` fields are submitted in relation to `required & core` fields,
// which are verified at upload/data-validate step. So can assume record is valid.
const calcDonorCoreEntityStats = (
  donor: Donor,
  clinicalType: CoreClinicalSchemaName,
  forceFlags: ForceRecaculateFlags, // used to control recalculate under certain conditions
) => {
  if (noNeedToCalcCoreStat(donor, clinicalType, forceFlags)) return;

  const coreStats = cloneDeep(donor.completenessStats?.coreCompletion) || getEmptyCoreStats();

  if (clinicalType === ClinicalEntitySchemaNames.SPECIMEN) {
    // for specimen, need to check all specimen has a record and at least one tumor and one normal exists
    const tumorAndNormalExists =
      donor.specimens.some(sp => sp.tumourNormalDesignation === 'Normal') &&
      donor.specimens.some(sp => sp.tumourNormalDesignation === 'Tumour');

    if (tumorAndNormalExists) {
      coreStats[schemaNameToCoreCompletenessStat[clinicalType]] =
        donor.specimens.map(sp => sp.clinicalInfo).filter(notEmpty).length / donor.specimens.length;
    } else {
      coreStats[schemaNameToCoreCompletenessStat[clinicalType]] = 0;
    }
  } else {
    // for others we just need to find one clinical info for core entity
    const entites = getClinicalEntitiesFromDonorBySchemaName(donor, clinicalType);
    coreStats[schemaNameToCoreCompletenessStat[clinicalType]] = entites.length >= 1 ? 1 : 0;
  }

  donor.completenessStats = {
    ...donor.completenessStats,
    coreCompletion: coreStats,
    overriddenCoreCompletion: pull(
      donor.completenessStats?.overriddenCoreCompletion || [],
      schemaNameToCoreCompletenessStat[clinicalType],
    ),
  };
};

export const recalculateDonorStatsHoldOverridden = (donor: Donor) => {
  coreClinialSchemaNamesSet.forEach(type =>
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
  if (!donor.completenessStats) return donor;

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
  if (isCoreEntitySchemaName(clinicalType)) {
    calcDonorCoreEntityStats(donor, clinicalType as CoreClinicalSchemaName, {
      recalcEvenIfComplete: false,
      recalcEvenIfOverriden: true,
    });
  }
};

export const forceRecalcDonorCoreEntityStats = (
  donor: DeepReadonly<Donor>,
  coreStatOverride: any = {},
) => {
  if (!isValidCoreStatOverride(coreStatOverride)) {
    throw new Error(`Invalid coreStatOverride`);
  }

  const donorUpdated = cloneDeep(donor) as Donor;

  coreClinialSchemaNamesSet.forEach(type =>
    calcDonorCoreEntityStats(donorUpdated, type as CoreClinicalSchemaName, {
      recalcEvenIfComplete: true,
      recalcEvenIfOverriden: true,
    }),
  );

  const newCoreCompletion = {
    ...donorUpdated.completenessStats?.coreCompletion, // set recalculated core completion
    ...coreStatOverride, // merge coreStatOverride
  };

  donorUpdated.completenessStats = {
    ...donorUpdated.completenessStats,
    coreCompletion: newCoreCompletion,
    overriddenCoreCompletion: Object.keys(coreStatOverride || {}) as CoreClinicalEntites[],
  };

  return donorUpdated;
};

// currently invalid core entities are set to zero
export const setInvalidCoreEntityStatsForMigration = (
  donor: DeepReadonly<Donor>,
  invalidEntities: string[],
) => {
  const mutableDonor = cloneDeep(donor) as Donor;

  const overriddenCoreEntities = mutableDonor.completenessStats?.overriddenCoreCompletion || [];
  const coreCompletion = mutableDonor.completenessStats?.coreCompletion || getEmptyCoreStats();

  invalidEntities.filter(isCoreEntitySchemaName).forEach(coreEntity => {
    coreCompletion[schemaNameToCoreCompletenessStat[coreEntity as CoreClinicalSchemaName]] = 0;
    pull(overriddenCoreEntities, coreEntity);
  });

  mutableDonor.completenessStats = {
    ...mutableDonor.completenessStats,
    coreCompletion: coreCompletion,
    overriddenCoreCompletion: overriddenCoreEntities,
  };
  return mutableDonor;
};

const getEmptyCoreStats = (): CoreCompletionStats => {
  return cloneDeep({
    donor: 0,
    specimens: 0,
    primaryDiagnosis: 0,
    followUps: 0,
    treatments: 0,
  });
};

const isCoreEntitySchemaName = (clinicalType: string) =>
  coreClinialSchemaNamesSet.has(clinicalType as CoreClinicalSchemaName);

function noNeedToCalcCoreStat(
  donor: Donor,
  clinicalType: CoreClinicalSchemaName,
  forceFlags: ForceRecaculateFlags,
) {
  // if entity was manually overriden, don't recalculate (might set to undesired value)
  if (
    !forceFlags.recalcEvenIfOverriden &&
    donor.completenessStats?.overriddenCoreCompletion.find(
      type => type === schemaNameToCoreCompletenessStat[clinicalType],
    )
  ) {
    return true;
  }

  // if entity is already core complete it can't become uncomplete since records can't be deleted
  // only exception is if specimens are added
  if (
    !forceFlags.recalcEvenIfComplete &&
    (donor.completenessStats?.coreCompletion || {})[
      schemaNameToCoreCompletenessStat[clinicalType]
    ] === 1
  ) {
    return true;
  }
  return false;
}

function isValidCoreStatOverride(updatedCompletion: any): updatedCompletion is CoreCompletionStats {
  return Object.entries(updatedCompletion).every(
    ([type, val]) =>
      Object.values(schemaNameToCoreCompletenessStat).find(field => type === field) &&
      isNumber(val) &&
      val >= 0 &&
      val <= 1,
  );
}
