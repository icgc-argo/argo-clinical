import { loggerFor } from '../logger';
import mongoose from 'mongoose';
import { F, MongooseUtils } from '../utils';

const L = loggerFor(__filename);

export interface ConfigurationRepository {
  setSubmissionLock(lock: boolean): Promise<Configuration | null>;
  getSubmissionLockStatus(): Promise<boolean>;
  create(configuration: any): Promise<Configuration>;
  update(configuration: any): Promise<Configuration>;
}

export const configRepository: ConfigurationRepository = {
  async create(configuration: any) {
    const existingConfiguration = await ConfigurationModel.findOne({}).exec();
    if (existingConfiguration) {
      throw new Error('Configuration already exists, can have only one');
    }

    const newconfiguration = new ConfigurationModel(configuration);
    await newconfiguration.save();
    return F(MongooseUtils.toPojo(newconfiguration));
  },

  async update(configuration: any) {
    return await ConfigurationModel.findOneAndUpdate(
      {},
      { ...configuration },
      { upsert: true, new: true },
    ).exec();
  },
  async setSubmissionLock(lock: boolean): Promise<Configuration> {
    const updatedConfig = await ConfigurationModel.findOneAndUpdate(
      {},
      { submissionLock: lock },
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
    submissionLock: Boolean,
  },
  { timestamps: true, minimize: false },
);

export const ConfigurationModel = mongoose.model<ConfigurationDocument>(
  'Configuration',
  ConfigurationSchema,
);
