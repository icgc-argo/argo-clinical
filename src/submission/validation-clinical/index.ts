import * as donor from './donor';
import * as specimen from './specimen';
import * as follow_up from './followUp';
import * as treatment from './treatment';
import * as chemotherapy from './chemotherapy';

// this done because typescript doesn't allow mapping with string index signature for default export
const availableValidators: { [k: string]: any } = {
  donor,
  specimen,
  follow_up,
  treatment,
  chemotherapy,
};

export const submissionValidator = (clinicalType: string): any => {
  const validator = availableValidators[clinicalType];
  if (!validator) {
    // return a dummy validator if one doesn't exist
    return { validate: () => [] };
  }
  return validator;
};
