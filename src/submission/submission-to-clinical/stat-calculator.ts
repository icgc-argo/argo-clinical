import {
  ClinicalEntity,
  Donor,
  ClinicalInfo,
  ClinicalInfoStats,
  AggregateClinicalInfoStats,
} from '../../../src/clinical/clinical-entities';
import { ClinicalEntitySchemaNames } from '../submission-entities';
import { isNotAbsent } from '../../../src/utils';

import * as schemaManager from '../schema/schema-manager';

const emptyStats: ClinicalInfoStats = {
  submittedCoreFields: 0,
  submittedExtendedFields: 0,
  expectedCoreFields: 0,
  expectedExtendedFields: 0,
};

export const updateClinicalStatsAndDonorStats = (
  entity: ClinicalEntity | Donor | undefined,
  donor: Donor,
  clinicalType: ClinicalEntitySchemaNames,
) => {
  if (!entity?.clinicalInfo) return;

  const originalStats: ClinicalInfoStats = entity.clinicalInfoStats || emptyStats;
  const newStats = calcNewStats(entity.clinicalInfo, clinicalType);

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
): ClinicalInfoStats => {
  const expectedCoreFields = getCoreFields(clinicalType);

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

function getCoreFields(clinicalType: ClinicalEntitySchemaNames): string[] {
  const clinicalSchemaDef = schemaManager
    .instance()
    .getSchemasWithFields({ name: clinicalType }, { meta: { core: true } })[0];
  return clinicalSchemaDef.fields || [];
}
