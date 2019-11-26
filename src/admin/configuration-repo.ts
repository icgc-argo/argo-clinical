import { loggerFor } from '../logger';
import mongoose from 'mongoose';

const L = loggerFor(__filename);

export interface PersistedConfigurationRepository {
  createOrUpdate(configuration: any): Promise<Configuration>;
  setSubmissionLock(lock: boolean): Promise<Configuration | null>;
  getSubmissionLockStatus(): Promise<boolean>;
}

export const configRepository: PersistedConfigurationRepository = {
  async createOrUpdate(configuration: any) {
    return await ConfigurationModel.findOneAndUpdate(
      {},
      { ...configuration },
      { upsert: true, new: true },
    ).exec();
  },
  async setSubmissionLock(lockSetting: boolean): Promise<Configuration> {
    const updatedConfig = await ConfigurationModel.findOneAndUpdate(
      {},
      { submissionLock: lockSetting },
      { new: true },
    ).exec();
    if (!updatedConfig) {
      throw new Error('Missing configurations!');
    }
    return updatedConfig;
  },
  async getSubmissionLockStatus() {
    const configuration = await ConfigurationModel.findOne({}).exec();
    if (!configuration) {
      throw new Error('Missing configurations!');
    }
    return configuration.submissionLock;
  },
};

interface Configuration {
  submissionLock: boolean;
}

type ConfigurationDocument = mongoose.Document & Configuration;

const ConfigurationSchema = new mongoose.Schema(
  {
    submissionLock: { type: Boolean, default: false },
  },
  { timestamps: true, minimize: false },
);

export const ConfigurationModel = mongoose.model<ConfigurationDocument>(
  'Configuration',
  ConfigurationSchema,
);
