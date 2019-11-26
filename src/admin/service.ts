import { configRepository } from './configuration-repo';

// this can/will be moved to a file..
const defaultConfiguration = {
  submissionLock: false,
};

export namespace operations {
  export const loadDefaultPersistedConfig = async () => {
    return await configRepository.createOrUpdate(defaultConfiguration);
  };
  export const setPersistedConifig = async (configuration: object) => {
    return await configRepository.createOrUpdate(configuration);
  };

  // *** Submission persisted-configuration operations ***
  export const setSubmissionLock = async (lockSetting: boolean) => {
    return await configRepository.setSubmissionLock(lockSetting);
  };
  export const getSubmissionLockStatus = async () => {
    return await configRepository.getSubmissionLockStatus();
  };
}
