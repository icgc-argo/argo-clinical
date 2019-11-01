import mongoose from 'mongoose';
import { loggerFor } from '../../logger';
import { MongooseUtils, F } from '../../utils';
import { MigrationState, DictionaryMigration } from './migration-entities';
const L = loggerFor(__filename);

export interface DictionaryMigrationRepository {
  create(migration: DictionaryMigration): Promise<DictionaryMigration | undefined>;
  getByState(state: MigrationState): Promise<DictionaryMigration | undefined>;
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
};

type DictionaryMigrationDocument = mongoose.Document & DictionaryMigration;

const DictionaryMigrationSchema = new mongoose.Schema(
  {
    fromVersion: { type: String, unique: true, required: true },
    toVersion: { type: String, unique: true, required: true },
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
    createdBy: { type: String, required: true },
  },
  { timestamps: true, minimize: false },
);

export const DictionaryMigrationModel = mongoose.model<DictionaryMigrationDocument>(
  'DictionaryMigration',
  DictionaryMigrationSchema,
);
