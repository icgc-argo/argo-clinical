import { Donor } from '../../../src/clinical/clinical-entities';
import { ClinicalEntitySchemaNames, CoreClinicalEntites } from '../submission-entities';
import { notEmpty, F } from '../../../src/utils';

import { getClinicalEntitiesFromDonorBySchemaName } from './submission-to-clinical';
import { DeepReadonly } from 'deep-freeze';
import { cloneDeep, pull } from 'lodash';
import { isNumber } from 'util';

type ForceRecaculateFlags = {
  recalcEvenIfComplete?: boolean; // used to force recalculate if stat is already 100%
  recalcEvenIfOverriden?: boolean; // used to force recalculate if previously overriden
};

const coreClinialEntities = new Set<CoreClinicalEntites>([
  ClinicalEntitySchemaNames.DONOR,
  ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
  ClinicalEntitySchemaNames.TREATMENT,
  ClinicalEntitySchemaNames.FOLLOW_UP,
  ClinicalEntitySchemaNames.SPECIMEN,
]);

// This is the main core stat caclulation function.
// We conisder only `required & core` fields for core field calculation, which are always submitted.
// Additionally, `optional & core` fields are submitted in relation to `required & core` fields,
// which are verified at upload/data-validate step. So can assume record is valid.
const calcDonorCoreEntityStats = (
  donor: Donor,
  clinicalType: CoreClinicalEntites,
  forceFlags: ForceRecaculateFlags, // used to control recalculate under certain conditions
) => {
  if (noNeedToCalcCoreStat(donor, clinicalType, forceFlags)) return;

  const coreStats = cloneDeep(donor.aggregatedInfoStats?.coreEntitiesStats) || getEmptyCoreStats();

  if (clinicalType === ClinicalEntitySchemaNames.SPECIMEN) {
    // for specimen, need to check all specimen has a record and at least one tumor and one normal exists
    const tumorAndNormalExists =
      donor.specimens.some(sp => sp.tumourNormalDesignation === 'Normal') &&
      donor.specimens.some(sp => sp.tumourNormalDesignation === 'Tumour');

    coreStats[clinicalType] = tumorAndNormalExists
      ? donor.specimens.map(sp => sp.clinicalInfo).filter(notEmpty).length / donor.specimens.length
      : 0;
  } else {
    // for others we just need to find one clinical info for core entity
    coreStats[clinicalType] =
      getClinicalEntitiesFromDonorBySchemaName(donor, clinicalType).length >= 1 ? 1 : 0;
  }

  donor.aggregatedInfoStats = {
    ...donor.aggregatedInfoStats,
    coreEntitiesStats: coreStats,
    overriddenCoreEntities: pull(
      donor.aggregatedInfoStats?.overriddenCoreEntities || [],
      clinicalType,
    ),
  };
};

export const recalculateDonorStatsHoldOverridden = (donor: Donor) => {
  coreClinialEntities.forEach(type =>
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
  if (!donor.aggregatedInfoStats) return donor;

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
  if (isCoreEntity(clinicalType)) {
    calcDonorCoreEntityStats(donor, clinicalType as CoreClinicalEntites, {
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

  coreClinialEntities.forEach(type =>
    calcDonorCoreEntityStats(donorUpdated, type, {
      recalcEvenIfComplete: true,
      recalcEvenIfOverriden: true,
    }),
  );

  const newCoreCompletion = {
    ...donorUpdated.aggregatedInfoStats?.coreEntitiesStats, // set recalculated core completion
    ...coreStatOverride, // merge coreStatOverride
  };

  donorUpdated.aggregatedInfoStats = {
    ...donorUpdated.aggregatedInfoStats,
    coreEntitiesStats: newCoreCompletion,
    overriddenCoreEntities: Object.keys(coreStatOverride || {}),
  };

  return donorUpdated;
};

// currently invalid core entities are set to zero
export const setInvalidCoreEntityStatsForMigration = (
  donor: DeepReadonly<Donor>,
  invalidEntities: string[],
) => {
  const mutableDonor = cloneDeep(donor) as Donor;

  const overriddenCoreEntities = mutableDonor.aggregatedInfoStats?.overriddenCoreEntities || [];
  const coreStats = mutableDonor.aggregatedInfoStats?.coreEntitiesStats || getEmptyCoreStats();

  invalidEntities.filter(isCoreEntity).forEach(coreEntity => {
    coreStats[coreEntity as CoreClinicalEntites] = 0;
    pull(overriddenCoreEntities, coreEntity);
  });

  mutableDonor.aggregatedInfoStats = {
    ...mutableDonor.aggregatedInfoStats,
    coreEntitiesStats: coreStats,
    overriddenCoreEntities: overriddenCoreEntities,
  };
  return mutableDonor;
};

const getEmptyCoreStats = (): Record<CoreClinicalEntites, number> => {
  return cloneDeep({
    [ClinicalEntitySchemaNames.DONOR]: 0,
    [ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]: 0,
    [ClinicalEntitySchemaNames.TREATMENT]: 0,
    [ClinicalEntitySchemaNames.FOLLOW_UP]: 0,
    [ClinicalEntitySchemaNames.SPECIMEN]: 0,
  });
};

const isCoreEntity = (clinicalType: string) =>
  coreClinialEntities.has(clinicalType as CoreClinicalEntites);

function noNeedToCalcCoreStat(
  donor: Donor,
  clinicalType: CoreClinicalEntites,
  forceFlags: ForceRecaculateFlags,
) {
  // if entity was manually overriden, don't recalculate (might set to undesired value)
  if (
    !forceFlags.recalcEvenIfOverriden &&
    donor.aggregatedInfoStats?.overriddenCoreEntities?.find(type => type === clinicalType)
  ) {
    return true;
  }

  // if entity is already core complete it can't become uncomplete since records can't be deleted
  // only exception is if specimens are added
  if (
    !forceFlags.recalcEvenIfComplete &&
    (donor.aggregatedInfoStats?.coreEntitiesStats || {})[clinicalType] === 1
  ) {
    return true;
  }
  return false;
}

function isValidCoreStatOverride(updatedCompletion: any) {
  return Object.entries(updatedCompletion).every(
    ([type, val]) =>
      coreClinialEntities.has(type as CoreClinicalEntites) && isNumber(val) && val >= 0 && val <= 1,
  );
}
