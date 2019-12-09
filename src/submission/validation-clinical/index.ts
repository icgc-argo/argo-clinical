import * as donor from './donor';
import * as specimen from './specimen';
import * as primary_diagnosis from './primary_diagnosis';

// this done because typescript doesn't allow mapping with string index signature for default export
const availableValidators: { [k: string]: any } = {
  donor,
  primary_diagnosis,
  specimen,
};

export const submissionValidator = (clinicalType: string): any => {
  const validator = availableValidators[clinicalType];
  if (!validator) {
    // gracefully return a dummy validators if one doesn't exist
    return { validate: () => [] };
  }
  return validator;
};
