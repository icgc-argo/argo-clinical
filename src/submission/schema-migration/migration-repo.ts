import mongoose from 'mongoose';
import { loggerFor } from '../../logger';
import { MongooseUtils, F, notEmpty } from '../../utils';
import { MigrationState, DictionaryMigration } from './migration-entities';
import { DeepReadonly } from 'deep-freeze';
import { ObjectID, ObjectId } from 'bson';
const L = loggerFor(__filename);

export interface DictionaryMigrationRepository {
  getAll(): Promise<DeepReadonly<DictionaryMigration[]>>;
  create(migration: DictionaryMigration): Promise<DictionaryMigration | undefined>;
  getByState(state: MigrationState): Promise<DictionaryMigration | undefined>;
  getById(migrationId: string): Promise<DictionaryMigration | undefined>;
  update(migration: DictionaryMigration): Promise<void>;
}

export const migrationRepo: DictionaryMigrationRepository = {
  create: async (migration: DictionaryMigration): Promise<DictionaryMigration | undefined> => {
    const doc = new DictionaryMigrationModel(migration);
    await doc.save();
    return F(MongooseUtils.toPojo(doc));
  },
  getByState: async (state: MigrationState): Promise<DictionaryMigration | undefined> => {
    L.debug('in migration repo get');
    const migration = await DictionaryMigrationModel.findOne({ state: state }).exec();
    if (migration == undefined) {
      return undefined;
    }
    return F(MongooseUtils.toPojo(migration));
  },
  getAll: async (): Promise<DeepReadonly<DictionaryMigration[]>> => {
    const migrationDocs = await DictionaryMigrationModel.find({}).exec();
    const migrations = migrationDocs
      .map(d => {
        return MongooseUtils.toPojo(d);
      })
      .filter(notEmpty);
    return F(migrations);
  },
  getById: async (migrationId: string): Promise<DictionaryMigration | undefined> => {
    L.debug('in migration repo get');
    const migration = await DictionaryMigrationModel.findOne({ _id: migrationId }).exec();
    if (migration == undefined) {
      return undefined;
    }
    return F(MongooseUtils.toPojo(migration));
  },
  update: async (migration: DictionaryMigration): Promise<void> => {
    const doc = new DictionaryMigrationModel(migration);
    doc.isNew = false;
    await doc.save();
    return;
  },
};

type DictionaryMigrationDocument = mongoose.Document & DictionaryMigration;

const DictionaryMigrationSchema = new mongoose.Schema(
  {
    fromVersion: { type: String, required: true },
    toVersion: { type: String, required: true },
    state: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      required: true,
    },
    stage: {
      type: String,
      enum: ['SUBMITTED', 'ANALYZED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
      required: true,
    },
    analysis: {},
    dryRun: { type: Boolean, required: false },
    stats: {},
    createdBy: { type: String, required: true },
  },
  { timestamps: true, minimize: false },
);

export const DictionaryMigrationModel = mongoose.model<DictionaryMigrationDocument>(
  'DictionaryMigration',
  DictionaryMigrationSchema,
);
