import * as donor from './donor';
import * as specimen from './specimen';
import * as follow_up from './followUp';
import * as treatment from './treatment';
import * as therapy from './therapy';
import { ClinicalEntitySchemaNames } from '../../common-model/entities';
import * as primaryDiagnosis from './primaryDiagnosis';

// this done because typescript doesn't allow mapping with string index signature for default export
const availableValidators: { [k: string]: any } = {
  [ClinicalEntitySchemaNames.DONOR]: donor,
  [ClinicalEntitySchemaNames.SPECIMEN]: specimen,
  [ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]: primaryDiagnosis,
  [ClinicalEntitySchemaNames.FOLLOW_UP]: follow_up,
  [ClinicalEntitySchemaNames.TREATMENT]: treatment,
  // all therapies follow the same validation
  [ClinicalEntitySchemaNames.CHEMOTHERAPY]: therapy,
  [ClinicalEntitySchemaNames.RADIATION]: therapy,
  [ClinicalEntitySchemaNames.HORMONE_THERAPY]: therapy,
};

export const submissionValidator = (clinicalType: string): any => {
  const validator = availableValidators[clinicalType];
  if (!validator) {
    // return a dummy validator if one doesn't exist
    return { validate: () => [] };
  }
  return validator;
};
