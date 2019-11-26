import { loggerFor } from '../logger';
import mongoose from 'mongoose';

const L = loggerFor(__filename);

export interface PersistedConfigurationRepository {
  createOrUpdate(configuration: any): Promise<Configuration>;
  getPersistedConfig(): Promise<Configuration | null>;
  setSubmissionDisabled(disabled: boolean): Promise<boolean>;
  getSubmissionDisabled(): Promise<boolean>;
}

export const configRepository: PersistedConfigurationRepository = {
  async createOrUpdate(configuration: any) {
    return await ConfigurationModel.findOneAndUpdate(
      {},
      { ...configuration },
      { upsert: true, new: true },
    ).exec();
  },
  async getPersistedConfig() {
    return await ConfigurationModel.findOne({}).exec();
  },
  async setSubmissionDisabled(disabled: boolean) {
    const updatedConfig = await ConfigurationModel.findOneAndUpdate(
      {},
      { submissionDisabled: disabled },
      { new: true },
    ).exec();
    if (!updatedConfig) {
      throw new Error('Missing persisted configurations!');
    }
    return updatedConfig.submissionDisabled;
  },
  async getSubmissionDisabled() {
    const configuration = await ConfigurationModel.findOne({}).exec();
    if (!configuration) {
      throw new Error('Missing persisted configurations!');
    }
    return configuration.submissionDisabled;
  },
};

interface Configuration {
  submissionDisabled: boolean;
}

type ConfigurationDocument = mongoose.Document & Configuration;

const ConfigurationSchema = new mongoose.Schema(
  {
    submissionDisabled: { type: Boolean, default: false },
  },
  { timestamps: true, minimize: false },
);

export const ConfigurationModel = mongoose.model<ConfigurationDocument>(
  'Configuration',
  ConfigurationSchema,
);
