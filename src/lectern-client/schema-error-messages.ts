const INVALID_VALUE_ERROR_MESSAGE = 'The value is not permissible for this field.';
const ERROR_MESSAGES: { [key: string]: (errorData: any) => string } = {
  INVALID_FIELD_VALUE_TYPE: () => INVALID_VALUE_ERROR_MESSAGE,
  INVALID_BY_REGEX: () => INVALID_VALUE_ERROR_MESSAGE,
  INVALID_BY_SCRIPT: () => INVALID_VALUE_ERROR_MESSAGE,
  INVALID_ENUM_VALUE: () => INVALID_VALUE_ERROR_MESSAGE,
  MISSING_REQUIRED_FIELD: errorData => `${errorData.fieldName} is a required field.`,
};

// Returns the formatted message for the given error key, taking any required properties from the info object
// Default value is the errorType itself (so we can identify errorTypes that we are missing messages for and the user could look up the error meaning in our docs)
const schemaErrorMessage = (errorType: string, errorData: any = {}): string => {
  return errorType && Object.keys(ERROR_MESSAGES).includes(errorType)
    ? ERROR_MESSAGES[errorType](errorData)
    : errorType;
};

export default schemaErrorMessage;
