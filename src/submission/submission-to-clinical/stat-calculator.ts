import { ClinicalEntity, Donor, ClinicalInfo } from '../../../src/clinical/clinical-entities';
import { ClinicalEntitySchemaNames } from '../submission-entities';
import { isNotAbsent } from '../../../src/utils';

import * as schemaManager from '../schema/schema-manager';

const extendedFields = 101;
const emptyStats = { coreFields: 0, extendedFields };

export const updateClinicalEntityAndDonorStats = (
  entity: ClinicalEntity | Donor,
  donor: Donor,
  clinicalType: ClinicalEntitySchemaNames,
) => {
  if (!entity.clinicalInfo) return;

  const originalStat = entity.clinicalInfoStats || emptyStats;
  const newStats = calculateNewStats(entity.clinicalInfo, clinicalType);

  // update stats in entity
  entity.clinicalInfoStats = newStats;

  // calculate new total stats
  const currentTotalCoreFields = donor.totalStats?.totalCoreFields;
  const currentTotalExtendedFields = donor.totalStats?.totalExtendedFields;

  const updatedTotalCoreFields: number = currentTotalCoreFields
    ? currentTotalCoreFields - originalStat.coreFields + newStats.coreFields
    : newStats.coreFields;
  const updatedTotalExtendedFields: number = currentTotalExtendedFields
    ? currentTotalExtendedFields - originalStat.extendedFields + newStats.extendedFields
    : newStats.extendedFields;

  // update donor global stats
  donor.totalStats = {
    totalCoreFields: updatedTotalCoreFields,
    totalExtendedFields: updatedTotalExtendedFields,
  };
};

const calculateNewStats = (entityInfo: ClinicalInfo, clinicalType: ClinicalEntitySchemaNames) => {
  const expectedCoreFields = schemaManager.instance().getClinicalCoreFields()[clinicalType];

  let coreFieldsCount = 0;
  expectedCoreFields.forEach(field => (coreFieldsCount += isNotAbsent(entityInfo[field]) ? 1 : 0));

  return { coreFields: coreFieldsCount, extendedFields };
};
