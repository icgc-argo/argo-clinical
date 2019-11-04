import { migrationRepo } from './migration-repo';
import { Errors } from '../../utils';
import { DictionaryMigration } from './migration-entities';
import * as manager from '../../lectern-client/schema-manager';
import { Donor } from '../../clinical/clinical-entities';
import * as clinicalService from '../../clinical/clinical-service';
import { DeepReadonly } from 'deep-freeze';
import _ from 'lodash';

// TODO: this should kick any active submission/registration
export const updateSchemaVersion = async (toVersion: string) => {
  // submit the migration request
  await submitMigration(manager.instance().getCurrent().version, toVersion);

  // update the existing schema
  await manager.instance().loadNewVersion(manager.instance().getCurrent().name, toVersion);
};

export const probeSchemaUpgrade = async (from: string, to: string) => {
  return await manager.instance().analyzeChanges(from, to);
};

export const dryRunSchemaUpgrade = async (from: string, to: string) => {
  return await submitMigration(from, to, true);
};

const submitMigration = async (fromVersion: string, toVersion: string, dryRun?: boolean) => {
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
    dryRun: dryRun || false,
    stats: {
      invalidDocumentsCount: 0,
      totalProcessed: 0,
      validDocumentsCount: 0,
    },
  });

  if (!savedMigration) {
    throw new Error('failed to submit migration');
  }

  // start but don't wait on the migration process.
  startMigration(savedMigration);
  return savedMigration;
};

const startMigration = async (migration: DictionaryMigration) => {
  if (!migration._id) {
    throw new Error('Migration should have an id');
  }
  const migrationId = migration._id;
  const newSchemaVersion = migration.toVersion;
  const dryRun = migration.dryRun;

  // analyze changes
  const changeAnalysis = await manager
    .instance()
    .analyzeChanges(migration.fromVersion, migration.toVersion);

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
  // TODO enhance to report progress of migration to db
  // TODO report when done to slack
  let migrationDone = false;
  while (!migrationDone) {
    let invalidCount = 0;
    let validCount = 0;
    const donors = await getNextUncheckedDonorDocumentsBatch(migrationId, 20);

    // no more unchecked donors ??
    if (donors.length == 0) {
      // mark migration as done
      migrationDone = true;
      break;
    }

    // check invalidation criteria against each one
    for (const donor of donors) {
      if (shouldInvalidate(donor, invalidatingFields)) {
        // if invalid mark as invalid and update document metadata
        if (!dryRun) {
          await markDonorAsInvalid(donor, migrationId);
        } else {
          await updateMigrationIdOnly(donor, migrationId);
        }
        invalidCount += 1;
        continue;
      }

      if (!dryRun) {
        await markDonorAsValid(donor, migrationId, newSchemaVersion);
      } else {
        await updateMigrationIdOnly(donor, migrationId);
      }

      validCount += 1;
    }

    migration.stats.invalidDocumentsCount = invalidCount;
    migration.stats.validDocumentsCount = validCount;
    migration.stats.totalProcessed += donors.length;
    migrationRepo.update(migration);
  }

  migration.state = 'CLOSED';
  migration.stage = 'COMPLETED';

  await migrationRepo.update(migration);
  return migration;
};

const getNextUncheckedDonorDocumentsBatch = async (migrationId: string, limit: number) => {
  return await clinicalService.getDonorsByMigrationId(migrationId, limit);
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

const markDonorAsInvalid = async (donor: DeepReadonly<Donor>, migrationId: string) => {
  return await clinicalService.updateDonorSchemaMetadata(donor, migrationId, false);
};

const markDonorAsValid = async (
  donor: DeepReadonly<Donor>,
  migrationId: string,
  newSchemaVersion: string,
) => {
  return await clinicalService.updateDonorSchemaMetadata(
    donor,
    migrationId,
    true,
    newSchemaVersion,
  );
};

const updateMigrationIdOnly = async (donor: DeepReadonly<Donor>, migrationId: string) => {
  return await clinicalService.updateMigrationId(donor, migrationId);
};
