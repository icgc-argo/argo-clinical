import { migrationRepo } from './migration-repo';
import { Errors } from '../../utils';
import { DictionaryMigration } from './migration-entities';
import * as manager from '../schema-manager';
import * as schemaService from '../../lectern-client/schema-functions';
import { ChangeAnalysis, SchemasDictionary } from '../../lectern-client/schema-entities';
import { Donor } from '../../clinical/clinical-entities';
import * as clinicalService from '../../clinical/clinical-service';
import { DeepReadonly } from 'deep-freeze';
import _ from 'lodash';

// TODO: this should kick any active submission/registration
export const updateSchemaVersion = async (toVersion: string, updater: string) => {
  // submit the migration request
  await submitMigration(manager.instance().getCurrent().version, toVersion, updater);
  // update the existing schema
  await manager.instance().loadAndSaveNewVersion(manager.instance().getCurrent().name, toVersion);
};

export const probeSchemaUpgrade = async (from: string, to: string) => {
  const analysis = await manager.instance().analyzeChanges(from, to);
  const invalidatingFields = findInvalidatingChangesFields(analysis);
  return {
    analysis,
    invalidatingFields,
  };
};

export const dryRunSchemaUpgrade = async (toVersion: string, initiator: string) => {
  return await submitMigration(manager.instance().getCurrent().version, toVersion, initiator, true);
};

export const getMigration = async (migrationId: string | undefined) => {
  if (!migrationId) {
    return await migrationRepo.getAll();
  }

  const openMigration = await migrationRepo.getById(migrationId);
  if (!openMigration) {
    throw new Errors.NotFound(`no migration with that id ${migrationId}`);
  }
  return [openMigration];
};

const submitMigration = async (
  fromVersion: string,
  toVersion: string,
  initiator: string,
  dryRun?: boolean,
) => {
  // can't submit if a migration already open
  const openMigration = await migrationRepo.getByState('OPEN');

  if (openMigration) {
    throw new Errors.StateConflict('A migration is already active');
  }

  const savedMigration = await migrationRepo.create({
    fromVersion,
    toVersion,
    stage: 'SUBMITTED',
    state: 'OPEN',
    createdBy: initiator,
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

  if (dryRun) {
    const result = await startMigration(savedMigration);
    return result;
  }
  // start but **DONT** await on the migration process to finish.
  startMigration(savedMigration);
  return savedMigration;
};

const startMigration = async (roMigration: DeepReadonly<DictionaryMigration>) => {
  const migration = _.cloneDeep(roMigration) as DictionaryMigration;
  if (!migration._id) {
    throw new Error('Migration should have an id');
  }
  const migrationId = migration._id;
  const newSchemaVersion = migration.toVersion;
  const dryRun = migration.dryRun;

  const newTargetSchema = await manager
    .instance()
    .loadSchemaByVersion(manager.instance().getCurrent().name, newSchemaVersion);

  // analyze changes
  if (!migration.analysis) {
    const analysis = await manager
      .instance()
      .analyzeChanges(migration.fromVersion, newSchemaVersion);

    migration.analysis = analysis;
    await migrationRepo.update(migration);
  }

  // get the change analysis from the migration object
  const changeAnalysis = migration.analysis as ChangeAnalysis;

  // check for breaking changes
  const invalidatingFields: any = findInvalidatingChangesFields(changeAnalysis);

  await checkDonorDocuments(migration, migrationId, dryRun, invalidatingFields, newTargetSchema);

  // close migration
  migration.state = 'CLOSED';
  migration.stage = 'COMPLETED';
  await migrationRepo.update(migration);
  return migration;
};

// start iterating over paged donor documents records (that weren't checked before)
// TODO enhance to report progress of migration to db
// TODO report when done to slack
const checkDonorDocuments = async (
  migration: DictionaryMigration,
  migrationId: string,
  dryRun: boolean,
  invalidatingFields: any,
  newSchema: SchemasDictionary,
) => {
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
      if (shouldInvalidate(donor, newSchema, invalidatingFields)) {
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
        await markDonorAsValid(donor, migrationId, newSchema.version);
      } else {
        await updateMigrationIdOnly(donor, migrationId);
      }

      validCount += 1;
    }

    migration.stats.invalidDocumentsCount += invalidCount;
    migration.stats.validDocumentsCount += validCount;
    migration.stats.totalProcessed += donors.length;
    await migrationRepo.update(migration);
  }
};

const getNextUncheckedDonorDocumentsBatch = async (migrationId: string, limit: number) => {
  return await clinicalService.getDonorsByMigrationId(migrationId, limit);
};

// TODO: enhance to return invalidation reasons
const shouldInvalidate = (
  donor: DeepReadonly<Donor>,
  schema: SchemasDictionary,
  breakingChanges: any,
) => {
  let invalid = false;
  breakingChanges.forEach((c: any) => {
    // short circuit if already found invalidating criteria
    if (invalid) return;
    // TODO this can be optimized to only iterate over schemas
    // not fields since we only need to check the whole schema once.
    invalid = validateDonorAgainstNewSchema(c.fieldPath, schema, donor);
    return;
  });

  return invalid;
};

function prepareForSchemaReProcessing(o: any, submitterDonorId: string) {
  console.log('to string on record: ' + JSON.stringify(o));
  // we copy to avoid frozen attributes
  const copy = _.cloneDeep(o);
  copy.submitter_donor_id = submitterDonorId;
  return toString(copy);
}

function toString(obj: any) {
  if (!obj) {
    return undefined;
  }
  Object.keys(obj).forEach(k => {
    if (typeof obj[k] === 'object') {
      return toString(obj[k]);
    }
    obj[k] = `${obj[k]}`;
  });

  return obj;
}

const validateDonorAgainstNewSchema = (
  schemaField: string,
  schema: SchemasDictionary,
  donor: DeepReadonly<Donor>,
) => {
  console.log(`checking donor ${donor.submitterId} for field: ${schemaField}`);
  const entity = schemaField.split('.')[0];

  if (entity == 'donor') {
    if (donor.clinicalInfo) {
      const result = schemaService.process(schema, entity, [
        prepareForSchemaReProcessing(donor.clinicalInfo, donor.submitterId),
      ]);
      if (result.validationErrors.length > 0) {
        return true;
      }
    }
  }

  if (entity == 'specimen') {
    let invalidFound = false;
    donor.specimens.forEach(sp => {
      if (invalidFound) return;
      if (sp.clinicalInfo) {
        const result = schemaService.process(schema, entity, [
          prepareForSchemaReProcessing(sp.clinicalInfo, donor.submitterId),
        ]);
        if (result.validationErrors.length > 0) {
          invalidFound = true;
        }
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
      const result = schemaService.process(schema, entity, [
        prepareForSchemaReProcessing(ce, donor.submitterId),
      ]);
      if (result.validationErrors.length > 0) {
        invalidFound = true;
      }
    });

    if (invalidFound) {
      return true;
    }
  }

  const result = schemaService.process(schema, entity, [
    prepareForSchemaReProcessing(clinicalEntity, donor.submitterId),
  ]);
  if (result.validationErrors.length > 0) {
    return true;
  }

  return false;
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

// TODO change this to find breaking changes in entities not fields.
function findInvalidatingChangesFields(changeAnalysis: ChangeAnalysis) {
  const invalidatingFields: any = [];
  /**************
   * CODELISTS
   ***************/
  // if we added a codeList restriction -> check other values
  changeAnalysis.restrictionsChanges.codeLists.created.forEach(cc => {
    invalidatingFields.push({
      type: 'CODELIST_ADDED',
      fieldPath: cc.field,
      newValidValues: cc.addition,
      noLongerValid: undefined, // this has to be changed to represent the set of All possible values
    });
  });

  // if we modifed codeList restriction, check for no longer valid values
  changeAnalysis.restrictionsChanges.codeLists.updated.forEach(cc => {
    invalidatingFields.push({
      type: 'CODELIST_UPDATED',
      fieldPath: cc.field,
      newValidValues: cc.addition,
      noLongerValid: cc.deletion,
    });
  });

  /**************
   * REGEX
   ***************/
  changeAnalysis.restrictionsChanges.regex.created.forEach(rc => {
    invalidatingFields.push({
      type: 'REGEX_ADDED',
      fieldPath: rc.field,
      newValidValue: rc.regex,
    });
  });

  changeAnalysis.restrictionsChanges.regex.updated.forEach(rc => {
    invalidatingFields.push({
      type: 'REGEX_UPDATED',
      fieldPath: rc.field,
      newValidValue: rc.regex,
    });
  });

  /** TODOS */
  // ******************
  // Ranges
  // ******************

  // ******************
  // Scripts
  // ******************

  // ******************
  // Adding new field
  // ******************

  // ******************
  // Removing a field
  // ******************

  return invalidatingFields;
}
