import { migrationRepo } from './migration-repo';
import { Errors } from '../../utils';
import { DictionaryMigration } from './migration-entities';
import * as manager from '../../lectern-client/schema-manager';
import { Donor } from '../../clinical/clinical-entities';
import * as clinicalService from '../../clinical/clinical-service';
import { DeepReadonly } from 'deep-freeze';
import _ from 'lodash';

const submitMigration = async (fromVersion: string, toVersion: string) => {
  // can't submit if a migration already open
  const openMigration = migrationRepo.getByState('OPEN');
  if (openMigration) {
    throw new Errors.StateConflict('A migration is already active');
  }

  const savedMigration = await migrationRepo.create({
    fromVersion,
    toVersion,
    stage: 'SUBMITTED',
    state: 'OPEN',
    analysis: undefined,
  });

  if (!savedMigration) {
    throw new Error('failed to submit migration');
  }
  // start but don't wait on the migration process.
  startMigration(savedMigration);
  return savedMigration;
};

const startMigration = async (migration: DictionaryMigration) => {
  // analyze changes
  const changeAnalysis = await manager.instance().analyzeChanges(migration.toVersion);

  // check for breaking changes
  const invalidatingFields: any = [];

  // if we added a codeList restriction -> check other values
  changeAnalysis.restrictionsChanges.codeLists.created.forEach(cc => {
    invalidatingFields.push({
      type: 'CODELIST_ADDED',
      fieldPath: cc.field,
      validValues: cc.addition,
      noLongerValid: undefined,
    });
  });

  // if we modifed codeList restriction, check for no longer valid values
  changeAnalysis.restrictionsChanges.codeLists.updated.forEach(cc => {
    invalidatingFields.push({
      type: 'CODELIST_UPDATED',
      fieldPath: cc.field,
      validValues: cc.addition,
      noLongerValid: cc.deletion,
    });
  });

  // start iterating over paged donor documents records (that weren't checked before)
  let migrationDone = false;
  while (!migrationDone) {
    const donors = await getNextUncheckedDonorDocumentsBatch(20);

    // no more unchecked donors ??
    if (donors.length == 0) {
      // mark migration as done
      migrationDone = true;
      break;
    }

    // check invalidation criteria against each one
    donors.forEach(async donor => {
      if (shouldInvalidate(donor, invalidatingFields)) {
        // if invalid mark as invalid and update document metadata
        await markDonorAsInvalid(donor);
      }
    });
  }
};

const getNextUncheckedDonorDocumentsBatch = async (batchSize: number) => {
  return await clinicalService.getDonors('');
};

// TODO: enhance to return invalidation reasons
const shouldInvalidate = (donor: DeepReadonly<Donor>, criteria: any) => {
  let flag = false;
  criteria.forEach((c: any) => {
    // short circuit if already found invalidating criteria
    if (flag) return;

    if (c.type == 'CODELIST_UPDATED') {
      const hasInvalidValue = donorHasInvalidValue(c.fieldPath, donor, c.noLongerValid);
      if (hasInvalidValue) {
        flag = true;
        return;
      }
    }

    if (c.type == 'CODELIST_ADDED') {
      const hasInvalidValue = donorHasInvalidValue(c.fieldPath, donor, c.noLongerValid);
      if (hasInvalidValue) {
        flag = true;
        return;
      }
    }
  });

  return flag;
};

const donorHasInvalidValue = (
  schemaField: string,
  donor: DeepReadonly<Donor>,
  invalidValues: any[],
) => {
  const entity = schemaField.split('.')[0];
  const fieldName = schemaField.split('.')[1];

  if (entity == 'donor') {
    if (donor.clinicalInfo) {
      return invalidValues.indexOf(donor.clinicalInfo[fieldName]) !== -1;
    }
  }

  if (entity == 'specimen') {
    let invalidFound = false;

    donor.specimens.forEach(sp => {
      if (invalidFound) return;
      if (sp.clinicalInfo) {
        invalidFound = invalidValues.indexOf(sp.clinicalInfo[fieldName]) !== -1;
      }
    });

    if (invalidFound) {
      return true;
    }
  }

  const donorFieldName = _.camelCase(entity) as keyof Donor;
  const clinicalEntity = donor[donorFieldName] || undefined;

  if (!clinicalEntity) {
    return false;
  }

  if (_.isArray(clinicalEntity)) {
    let invalidFound = false;
    clinicalEntity.forEach(ce => {
      if (invalidFound) return;
      invalidFound = invalidValues.indexOf(ce[fieldName]) !== -1;
    });
    if (invalidFound) {
      return true;
    }
  }

  return invalidValues.indexOf((clinicalEntity as { [field: string]: any })[fieldName]) !== -1;
};

const markDonorAsInvalid = async (donor: DeepReadonly<Donor>) => {
  return await clinicalService.updateDonorSchemaMetadata(donor);
};
