import { migrationRepo } from './migration-repo';
import { Errors } from '../../utils';
import { DictionaryMigration } from './migration-entities';
import * as manager from '../../lectern-client/schema-manager';

const submitMigration = async (fromVersion: string, toVersion: string) => {
  const existingMigration = migrationRepo.getByState('OPEN');
  if (existingMigration) {
    throw new Errors.StateConflict('Migration already submitted');
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
  const changeAnalysis = await manager.instance().analyzeChanges(migration.toVersion);
};
