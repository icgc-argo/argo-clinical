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
  const allSubmittedCoreFields = aggregatedStats?.submittedCoreFields || 0;
  const allSubmittedExtendedFields = aggregatedStats?.submittedExtendedFields || 0;
  const allAvailableCoreFields = aggregatedStats?.expectedCoreFields || 0;
  const allAvailableExtendedFields = aggregatedStats?.expectedExtendedFields || 0;

  const allSubmittedCoreFieldsUpdate: number =
    allSubmittedCoreFields - originalStats.submittedCoreFields + newStats.submittedCoreFields;
  const allSubmittedExtendedFieldsUpdate: number =
    allSubmittedExtendedFields -
    originalStats.submittedExtendedFields +
    newStats.submittedExtendedFields;
  const allAvailableCoreFieldsUpdate: number =
    allAvailableCoreFields - originalStats.expectedCoreFields + newStats.expectedCoreFields;
  const allAvailableExtendedFieldsUpdate: number =
    allAvailableExtendedFields -
    originalStats.expectedExtendedFields +
    newStats.expectedExtendedFields;

  return {
    submittedCoreFields: allSubmittedCoreFieldsUpdate,
    submittedExtendedFields: allSubmittedExtendedFieldsUpdate,
    expectedCoreFields: allAvailableCoreFieldsUpdate,
    expectedExtendedFields: allAvailableExtendedFieldsUpdate,
  };
}

function getCoreFields(clinicalType: ClinicalEntitySchemaNames): string[] {
  const clinicalSchemaDef = schemaManager
    .instance()
    .getSchemasWithFields({ name: clinicalType }, { meta: { core: true } })[0];
  return clinicalSchemaDef.fields;
}
