import * as donor from './donor';
import * as specimen from './specimen';
import * as primary_diagnosis from './primary_diagnosis';
import * as follow_up from './followUp';
import * as treatment from './treatment';
import * as chemotherapy from './chemotherapy';

// this done because typescript doesn't allow mapping with string index signature for default export
const availableValidators: { [k: string]: any } = {
  donor,
  primary_diagnosis,
  specimen,
  follow_up,
  treatment,
  chemotherapy,
};

export const submissionValidator = (clinicalType: string): any => {
  const validator = availableValidators[clinicalType];
  if (!validator) {
    // return a dummy validator if one doesn't exist
    // note - if this validate is called no stats will be retured
    // that's ok because this will be refactored so stats are not returned by validate
    return { validate: () => [] };
  }
  return validator;
};
