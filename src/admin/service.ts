import { configRepository } from './configuration-repo';
import { loggerFor } from '../logger';
const L = loggerFor(__filename);

// this can/will be moved outside of code base..
const defaultConfiguration = {
  submissionDisabled: false,
};

export namespace operations {
  // load defaults if no persisted config present
  export const setDefaultPersistedConfig = async () => {
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
}
