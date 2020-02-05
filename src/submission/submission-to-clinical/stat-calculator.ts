import {
  ClinicalEntity,
  Donor,
  ClinicalInfo,
  ClinicalStats,
  AggregateDonorStats,
} from '../../../src/clinical/clinical-entities';
import { ClinicalEntitySchemaNames } from '../submission-entities';
import { isNotAbsent } from '../../../src/utils';

import * as schemaManager from '../schema/schema-manager';

const emptyStats: ClinicalStats = {
  submittedCoreFields: 0,
  submittedExtendedFields: 0,
  availableCoreFields: 0,
  availableExtendedFields: 0,
};

export const updateClinicalStatsAndDonorStats = (
  entity: ClinicalEntity | Donor | undefined,
  donor: Donor,
  clinicalType: ClinicalEntitySchemaNames,
) => {
  if (!entity?.clinicalInfo) return;

  const originalStats: ClinicalStats = entity.clinicalStats || emptyStats;
  const newStats = calcNewStats(entity.clinicalInfo, clinicalType);

  entity.clinicalStats = newStats;
  donor.aggregatedStats = calcAggregateStats(donor.aggregatedStats, newStats, originalStats);
};

const calcNewStats = (
  entityInfo: ClinicalInfo,
  clinicalType: ClinicalEntitySchemaNames,
): ClinicalStats => {
  const expectedCoreFields = getCoreFields(clinicalType);

  let submittedCoreFields = 0;
  expectedCoreFields.forEach(
    field => (submittedCoreFields += isNotAbsent(entityInfo[field]) ? 1 : 0),
  );

  return {
    submittedCoreFields,
    submittedExtendedFields: 0,
    availableCoreFields: expectedCoreFields.length,
    availableExtendedFields: 0,
  };
};

function calcAggregateStats(
  aggregatedStats: AggregateDonorStats | undefined,
  newStats: ClinicalStats,
  originalStats: ClinicalStats,
): AggregateDonorStats {
  const allSubmittedCoreFields = aggregatedStats?.submittedCoreFields || 0;
  const allSubmittedExtendedFields = aggregatedStats?.submittedExtendedFields || 0;
  const allAvailableCoreFields = aggregatedStats?.availableCoreFields || 0;
  const allAvailableExtendedFields = aggregatedStats?.availableExtendedFields || 0;

  const allSubmittedCoreFieldsUpdate: number =
    allSubmittedCoreFields - originalStats.submittedCoreFields + newStats.submittedCoreFields;
  const allSubmittedExtendedFieldsUpdate: number =
    allSubmittedExtendedFields -
    originalStats.submittedExtendedFields +
    newStats.submittedExtendedFields;
  const allAvailableCoreFieldsUpdate: number =
    allAvailableCoreFields - originalStats.availableCoreFields + newStats.availableCoreFields;
  const allAvailableExtendedFieldsUpdate: number =
    allAvailableExtendedFields -
    originalStats.availableExtendedFields +
    newStats.availableExtendedFields;

  return {
    submittedCoreFields: allSubmittedCoreFieldsUpdate,
    submittedExtendedFields: allSubmittedExtendedFieldsUpdate,
    availableCoreFields: allAvailableCoreFieldsUpdate,
    availableExtendedFields: allAvailableExtendedFieldsUpdate,
  };
}

function getCoreFields(clinicalType: ClinicalEntitySchemaNames): string[] {
  const clinicalSchemaDef = schemaManager
    .instance()
    .getSchemasWithFields({ name: clinicalType }, { meta: { core: true } })[0];
  return clinicalSchemaDef.fields;
}
