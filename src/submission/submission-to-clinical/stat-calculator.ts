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
  expectedCoreFields: 0,
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
    expectedCoreFields: expectedCoreFields.length,
  };
};

function calcAggregateStats(
  aggregatedStats: AggregateClinicalInfoStats | undefined,
  newStats: ClinicalInfoStats,
  originalStats: ClinicalInfoStats,
): AggregateClinicalInfoStats {
  const currentSubmittedCoreFields = aggregatedStats?.submittedCoreFields || 0;
  const currentAvailableCoreFields = aggregatedStats?.expectedCoreFields || 0;

  const updatedSubmittedCoreFields: number =
    currentSubmittedCoreFields - originalStats.submittedCoreFields + newStats.submittedCoreFields;
  const updatedAvailableCoreFields: number =
    currentAvailableCoreFields - originalStats.expectedCoreFields + newStats.expectedCoreFields;

  return {
    submittedCoreFields: updatedSubmittedCoreFields,
    expectedCoreFields: updatedAvailableCoreFields,
  };
}

// meta fields have no validation in lectern so its possible that it is a string instead of boolean
const fieldDefWithMetaCoreTruePredicate = (fieldDef: any) =>
  fieldDef?.meta?.core?.toString().toLowerCase() === 'true';

function getCoreFields(
  clinicalType: ClinicalEntitySchemaNames,
  overrideSchema?: SchemasDictionary,
): string[] {
  if (notEmpty(overrideSchema)) {
    return (
      overrideSchema.schemas
        .find(s => s.name === clinicalType)
        ?.fields.filter(fieldDefWithMetaCoreTruePredicate)
        .map(f => f.name) || []
    );
  }
  const clinicalSchemaDef = schemaManager
    .instance()
    .getSchemasWithFields({ name: clinicalType }, fieldDefWithMetaCoreTruePredicate)[0];
  return clinicalSchemaDef.fields || [];
}
