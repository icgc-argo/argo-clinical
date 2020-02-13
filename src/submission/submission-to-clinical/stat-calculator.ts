import {
  ClinicalEntity,
  Donor,
  ClinicalInfo,
  ClinicalInfoStats,
  AggregateClinicalInfoStats,
} from '../../../src/clinical/clinical-entities';
import { ClinicalEntitySchemaNames } from '../submission-entities';
import { isNotAbsent, isEmpty, notEmpty } from '../../../src/utils';

import * as schemaManager from '../schema/schema-manager';
import { getClinicalObjectsFromDonor } from './submission-to-clinical';
import { SchemasDictionary } from '../../../src/lectern-client/schema-entities';
import { DeepReadonly } from 'deep-freeze';
import _ from 'lodash';

const emptyStats: ClinicalInfoStats = {
  submittedCoreFields: 0,
  submittedExtendedFields: 0,
  expectedCoreFields: 0,
  expectedExtendedFields: 0,
};

// this function will reset stats and recalculate
export const recalculateAllClincalInfoStats = (
  donor: DeepReadonly<Donor>,
  overrideSchema?: SchemasDictionary,
) => {
  if (!donor.schemaMetadata.isValid) {
    throw new Error("Can't recalculate stats for donor that are invalid!");
  }
  const mutableDonor = _.cloneDeep(donor) as Donor;

  mutableDonor.aggregatedInfoStats = emptyStats;

  Object.values(ClinicalEntitySchemaNames)
    .filter(s => s !== ClinicalEntitySchemaNames.REGISTRATION)
    .forEach(s => {
      const clinicalEntities = getClinicalObjectsFromDonor(mutableDonor, s);
      clinicalEntities.forEach((clinicalEntity: any) => {
        if (isEmpty(clinicalEntity.clinicalInfo)) return;
        clinicalEntity.clinicalInfoStats = emptyStats;
        updateClinicalStatsAndDonorStats(clinicalEntity, mutableDonor, s, overrideSchema);
      });
    });

  return mutableDonor;
};

export const recalculateEntitiesClinicalInfoStats = (
  donor: DeepReadonly<Donor>,
  clinicalEntitestToRecalclate: ClinicalEntitySchemaNames[],
  overrideSchema?: SchemasDictionary,
) => {
  const mutableDonor = _.cloneDeep(donor) as Donor;

  Object.values(clinicalEntitestToRecalclate).forEach(s => {
    const clinicalEntities = getClinicalObjectsFromDonor(mutableDonor, s);
    clinicalEntities.forEach((clinicalEntity: any) => {
      updateClinicalStatsAndDonorStats(clinicalEntity, mutableDonor, s, overrideSchema);
    });
  });

  return mutableDonor;
};

// this function will mutate the entity
export const updateClinicalStatsAndDonorStats = (
  entity: ClinicalEntity | Donor | undefined,
  donor: Donor,
  clinicalType: ClinicalEntitySchemaNames,
  overrideSchema?: SchemasDictionary,
) => {
  if (!entity?.clinicalInfo || isEmpty(entity.clinicalInfo)) return;

  const originalStats: ClinicalInfoStats = entity.clinicalInfoStats || emptyStats;
  const newStats = calcNewStats(entity.clinicalInfo, clinicalType, overrideSchema);

  entity.clinicalInfoStats = newStats;
  donor.aggregatedInfoStats = calcAggregateStats(
    donor.aggregatedInfoStats,
    newStats,
    originalStats,
  );
};

const calcNewStats = (
  entityInfo: ClinicalInfo,
  clinicalType: ClinicalEntitySchemaNames,
  overrideSchema?: SchemasDictionary,
): ClinicalInfoStats => {
  const expectedCoreFields = getCoreFields(clinicalType, overrideSchema);

  let submittedCoreFields = 0;
  expectedCoreFields.forEach(
    field => (submittedCoreFields += isNotAbsent(entityInfo[field]) ? 1 : 0),
  );

  return {
    submittedCoreFields,
    submittedExtendedFields: 0,
    expectedCoreFields: expectedCoreFields.length,
    expectedExtendedFields: 0,
  };
};

function calcAggregateStats(
  aggregatedStats: AggregateClinicalInfoStats | undefined,
  newStats: ClinicalInfoStats,
  originalStats: ClinicalInfoStats,
): AggregateClinicalInfoStats {
  const currentSubmittedCoreFields = aggregatedStats?.submittedCoreFields || 0;
  const currentSubmittedExtendedFields = aggregatedStats?.submittedExtendedFields || 0;
  const currentAvailableCoreFields = aggregatedStats?.expectedCoreFields || 0;
  const currentAvailableExtendedFields = aggregatedStats?.expectedExtendedFields || 0;

  const updatedSubmittedCoreFields: number =
    currentSubmittedCoreFields - originalStats.submittedCoreFields + newStats.submittedCoreFields;
  const updatedSubmittedExtendedFields: number =
    currentSubmittedExtendedFields -
    originalStats.submittedExtendedFields +
    newStats.submittedExtendedFields;
  const updatedAvailableCoreFields: number =
    currentAvailableCoreFields - originalStats.expectedCoreFields + newStats.expectedCoreFields;
  const updatedAvailableExtendedFields: number =
    currentAvailableExtendedFields -
    originalStats.expectedExtendedFields +
    newStats.expectedExtendedFields;

  return {
    submittedCoreFields: updatedSubmittedCoreFields,
    submittedExtendedFields: updatedSubmittedExtendedFields,
    expectedCoreFields: updatedAvailableCoreFields,
    expectedExtendedFields: updatedAvailableExtendedFields,
  };
}

function getCoreFields(
  clinicalType: ClinicalEntitySchemaNames,
  overrideSchema?: SchemasDictionary,
): string[] {
  if (notEmpty(overrideSchema)) {
    return (
      overrideSchema.schemas
        .find(s => s.name === clinicalType)
        ?.fields.filter(f => f.meta?.core === true)
        .map(f => f.name) || []
    );
  }
  const clinicalSchemaDef = schemaManager
    .instance()
    .getSchemasWithFields({ name: clinicalType }, { meta: { core: true } })[0];
  return clinicalSchemaDef.fields || [];
}
