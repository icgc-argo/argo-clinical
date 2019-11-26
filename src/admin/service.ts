import { configRepository } from './configuration-repo';

// this can/will be moved to a file..
const defaultConfiguration = {
  submissionDisabled: false,
};

export namespace operations {
  export const loadDefaultPersistedConfig = async () => {
    return await configRepository.createOrUpdate(defaultConfiguration);
  };
  export const setPersistedConifig = async (configuration: object) => {
    return await configRepository.createOrUpdate(configuration);
  };

  // *** Submission persisted-configuration operations ***
  export const setSubmissionDisabledState = async (disableSetting: boolean) => {
    return await configRepository.setSubmissionDisabled(disableSetting);
  };
  export const getSubmissionDisabledState = async () => {
    return await configRepository.getSubmissionDisabled();
  };
}
