import { migrationRepo } from './migration-repo';
import { Errors, notEmpty } from '../../utils';
import { DictionaryMigration } from './migration-entities';
import * as manager from '../schema-manager';
import * as schemaService from '../../lectern-client/schema-functions';
import { ChangeAnalysis, SchemasDictionary } from '../../lectern-client/schema-entities';
import { Donor } from '../../clinical/clinical-entities';
import * as clinicalService from '../../clinical/clinical-service';
import { DeepReadonly } from 'deep-freeze';
import _ from 'lodash';
import { ClinicalEntityType } from '../submission-entities';
import { loggerFor } from '../../logger';
const L = loggerFor(__filename);

// TODO: this should update any active submission/registration
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
    invalidDonorsErrors: [],
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

  const newTargetSchema = await manager
    .instance()
    .loadSchemaByVersion(manager.instance().getCurrent().name, newSchemaVersion);

  await checkDonorDocuments(migration, newTargetSchema);

  // close migration
  const updatedMigration = await migrationRepo.getById(migrationId);
  const migrationToClose = _.cloneDeep(updatedMigration) as DictionaryMigration;
  if (!migrationToClose) {
    throw new Error('where did the migration go? expected migration not found');
  }
  migrationToClose.state = 'CLOSED';
  migrationToClose.stage = 'COMPLETED';
  const closedMigration = await migrationRepo.update(migrationToClose);
  return closedMigration;
};

// start iterating over paged donor documents records (that weren't checked before)
const checkDonorDocuments = async (
  migration: DictionaryMigration,
  newSchema: SchemasDictionary,
) => {
  let migrationDone = false;
  if (!migration._id) {
    throw new Error('Migration should have an id');
  }
  const migrationId = migration._id;
  const dryRun = migration.dryRun;
  const breakingChangesEntitesCache: { [versions: string]: string[] } = {};

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
      const result = await revalidateDonorClinicalEntities(
        donor,
        newSchema,
        breakingChangesEntitesCache,
      );
      if (result && result.length > 0) {
        // if invalid mark as invalid and update document metadata
        if (!dryRun) {
          await markDonorAsInvalid(donor, migrationId);
        } else {
          await updateMigrationIdOnly(donor, migrationId);
        }

        migration.invalidDonorsErrors.push({
          donorId: donor.donorId,
          submitterDonorId: donor.submitterId,
          programId: donor.programId,
          errors: result,
        });

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
    migration = await migrationRepo.update(migration);
  }
};

const getNextUncheckedDonorDocumentsBatch = async (migrationId: string, limit: number) => {
  return await clinicalService.getDonorsByMigrationId(migrationId, limit);
};

const revalidateDonorClinicalEntities = async (
  donor: DeepReadonly<Donor>,
  newSchema: SchemasDictionary,
  breakingChangesEntitesCache: { [versions: string]: string[] },
) => {
  const donorSchemaErrors: any[] = [];
  const donorDocSchemaVersion = donor.schemaMetadata.lastValidSchemaVersion;

  const versionsKey = `${donorDocSchemaVersion}->${newSchema.version}`;

  if (!breakingChangesEntitesCache[versionsKey]) {
    L.debug(`didn't find cached changes analysis for versions: ${versionsKey}`);
    // analyze changes between the document last valid schema
    const analysis = await manager
      .instance()
      .analyzeChanges(donor.schemaMetadata.lastValidSchemaVersion, newSchema.version);

    // check for breaking changes
    const invalidatingFields: any = findInvalidatingChangesFields(analysis);

    const schemaNamesWithBreakingChanges = _.uniqBy(
      invalidatingFields.map((inf: any) => {
        return inf.fieldPath.split('.')[0];
      }),
      (e: string) => e,
    );
    breakingChangesEntitesCache[versionsKey] = schemaNamesWithBreakingChanges;
  }

  const schemaNamesWithBreakingChanges = breakingChangesEntitesCache[versionsKey];
  for (const schemaName of schemaNamesWithBreakingChanges) {
    // not fields since we only need to check the whole schema once.
    const errors = validateDonorEntityAgainstNewSchema(schemaName, newSchema, donor);
    if (errors && errors.length > 0) {
      donorSchemaErrors.push({
        [schemaName]: errors,
      });
    }
  }
  return donorSchemaErrors;
};

const validateDonorEntityAgainstNewSchema = (
  schemaName: string,
  schema: SchemasDictionary,
  donor: DeepReadonly<Donor>,
) => {
  L.debug(`checking donor ${donor.submitterId} for schema: ${schemaName}`);

  if (schemaName == ClinicalEntityType.DONOR) {
    if (donor.clinicalInfo) {
      const result = schemaService.process(schema, schemaName, [
        prepareForSchemaReProcessing(donor.clinicalInfo),
      ]);
      if (result.validationErrors.length > 0) {
        return result.validationErrors;
      }
    }
  }

  if (schemaName == ClinicalEntityType.SPECIMEN) {
    const clinicalRecords = donor.specimens
      .map(sp => {
        if (sp.clinicalInfo) {
          return prepareForSchemaReProcessing(sp.clinicalInfo);
        }
      })
      .filter(notEmpty);
    const result = schemaService.process(schema, schemaName, clinicalRecords);
    if (result.validationErrors.length > 0) {
      return result.validationErrors;
    }
  }

  const donorFieldName = _.camelCase(schemaName) as keyof Donor;
  const clinicalEntity = (donor[donorFieldName] as object) || undefined;

  if (!clinicalEntity) {
    return undefined;
  }

  if (_.isArray(clinicalEntity)) {
    const records = clinicalEntity
      .map(ce => {
        return prepareForSchemaReProcessing(ce);
      })
      .filter(notEmpty);

    const result = schemaService.process(schema, schemaName, records);
    if (result.validationErrors.length > 0) {
      return result.validationErrors;
    }
  }

  const result = schemaService.process(schema, schemaName, [
    prepareForSchemaReProcessing(clinicalEntity),
  ]);

  if (result.validationErrors.length > 0) {
    return result.validationErrors;
  }

  return undefined;
};

function prepareForSchemaReProcessing(record: object) {
  // we copy to avoid frozen attributes
  const copy = _.cloneDeep(record);
  return toString(copy);
}

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
      newValidValue: rc.value,
    });
  });

  changeAnalysis.restrictionsChanges.regex.updated.forEach(rc => {
    invalidatingFields.push({
      type: 'REGEX_UPDATED',
      fieldPath: rc.field,
      newValidValue: rc.value,
    });
  });

  /**************
   * Required restrictions set
   ***************/
  changeAnalysis.restrictionsChanges.required.created.forEach(rc => {
    // if required added with value true
    if (rc.value) {
      invalidatingFields.push({
        type: 'REQUIRED_SET',
        fieldPath: rc.field,
        newValidValue: rc.value,
      });
    }
  });

  changeAnalysis.restrictionsChanges.required.updated.forEach(rc => {
    // if required added with value true
    if (rc.value) {
      invalidatingFields.push({
        type: 'REQUIRED_SET',
        fieldPath: rc.field,
        newValidValue: rc.value,
      });
    }
  });

  // ******************
  // Adding new required field
  // ******************
  changeAnalysis.fields.addedFields.forEach(rc => {
    if (rc.definition.restrictions && rc.definition.restrictions.required) {
      invalidatingFields.push({
        type: 'REQUIRED_FIELD_ADDED',
        fieldPath: rc.name,
      });
    }
  });

  // ******************
  // Removing a field
  // ******************
  changeAnalysis.fields.deletedFields.forEach(rc => {
    invalidatingFields.push({
      type: 'FIELD_REMOVED',
      fieldPath: rc,
    });
  });

  // ******************
  // Scripts
  // ******************
  changeAnalysis.restrictionsChanges.script.created.forEach(rc => {
    invalidatingFields.push({
      type: 'SCRIPT_ADDED',
      fieldPath: rc.field,
      newValidValue: rc.value,
    });
  });

  changeAnalysis.restrictionsChanges.script.updated.forEach(rc => {
    invalidatingFields.push({
      type: 'SCRIPT_UPDATED',
      fieldPath: rc.field,
      newValidValue: rc.value,
    });
  });

  // ******************
  // Ranges
  // ******************
  changeAnalysis.restrictionsChanges.range.created.forEach(rc => {
    invalidatingFields.push({
      type: 'RANGE_ADDED',
      fieldPath: rc.field,
    });
  });

  changeAnalysis.restrictionsChanges.range.updated.forEach(rc => {
    invalidatingFields.push({
      type: 'RANGE_UPDATED',
      fieldPath: rc.field,
    });
  });

  return invalidatingFields;
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
