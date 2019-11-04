const ERROR_MESSAGES: { [key: string]: (errorData: any) => string } = {
  /* ***************** *
   * VALIDATION ERRORS
   * ***************** */
  NEW_DONOR_CONFLICT: () =>
    'You are trying to register the same donor twice with different genders.',
  SAMPLE_BELONGS_TO_OTHER_SPECIMEN: errorData =>
    `Samples can only be registered to a single specimen. This sample has already been registered to specimen ${errorData.info.otherSpecimenSubmitterId}. Please correct your file or contact DCC to update the registered data.`,
  SPECIMEN_BELONGS_TO_OTHER_DONOR: errorData =>
    `Specimen can only be registered to a single donor. This specimen has already been registered to donor ${errorData.info.otherDonorSubmitterId}. Please correct your file or contact DCC to update the registered data.`,
  INVALID_PROGRAM_ID: () =>
    'Program ID does not match the program you are uploading to. Please include the correct Program ID.',
  MUTATING_EXISTING_DATA: errorData =>
    `The value does not match the previously registered value of ${errorData.info.originalValue}. Please correct your file or contact DCC to update the registered data.`,
  NEW_SAMPLE_ATTR_CONFLICT: () =>
    'You are trying to register the same sample with different sample types.',
  NEW_SPECIMEN_ATTR_CONFLICT: () =>
    'You are trying to register the same specimen with different values.',
  NEW_SPECIMEN_ID_CONFLICT: () =>
    'You are trying to register the same sample to multiple donors. Specimens can only be registered to a single donor.',
  NEW_SAMPLE_ID_CONFLICT: () =>
    'You are trying to register the same sample with multiple donors or specimens. Samples can only be registered to a single donor and specimen.',
  ID_NOT_REGISTERED: errorData =>
    `${errorData.info.value} has not yet been registered. Please register here before submitting clinical data for this identifier.`,
  CONFLICTING_TIME_INTERVAL: () =>
    'survival_time cannot be less than Specimen acquisition_interval.',
  NOT_ENOUGH_INFO_TO_VALIDATE: errorData =>
    `${errorData.info.field1} requires ${errorData.info.field2} in order to complete validation.  Please upload data for both fields in this clinical data submission.`,
  DUPLICATE_REGISTRATION_RECORD: () =>
    `You are trying to register the same sample in multiple rows. Samples can only be registered once.`,
  FOUND_IDENTICAL_IDS: fieldName =>
    `You are trying to submit the same [${fieldName}] in multiple rows. [${fieldName}] can only be submitted once per file.`,
};

// Returns the formatted message for the given error key, taking any required properties from the info object
// Default value is the errorType itself (so we can identify errorTypes that we are missing messages for and the user could look up the error meaning in our docs)
const validationErrorMessage = (errorType: string, errorData: any = {}): string => {
  return errorType && Object.keys(ERROR_MESSAGES).includes(errorType)
    ? ERROR_MESSAGES[errorType](errorData)
    : errorType;
};

export default validationErrorMessage;
