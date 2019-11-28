import { configRepository } from './repo';
import { loggerFor } from '../../logger';
const L = loggerFor(__filename);

const defaultConfiguration = {
  submissionDisabled: false,
};

// load defaults if no persisted config present
export const initSubmissionConfigsIfNoneExist = async () => {
  const persistedConfig = await configRepository.getPersistedConfig();
  if (persistedConfig) {
    L.debug(`persistedConfig is already set: ${persistedConfig}`);
    return persistedConfig;
  }
  L.debug(`persistedConfig not found setting defaults: ${defaultConfiguration}`);
  await configRepository.createOrUpdate(defaultConfiguration);
};

export const updatePersistedConifig = async (configuration: object) => {
  return await configRepository.createOrUpdate(configuration);
};

// *** Submission persisted-config operations ***
export const setSubmissionDisabledState = async (disableSetting: boolean) => {
  return await configRepository.setSubmissionDisabled(disableSetting);
};

export const getSubmissionDisabledState = async () => {
  return await configRepository.getSubmissionDisabled();
};

// load defaults if no persisted config present
export const getConfigs = async () => {
  return await configRepository.getPersistedConfig();
};
