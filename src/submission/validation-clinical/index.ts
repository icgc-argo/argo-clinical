import * as donor from './donor';
import * as specimen from './specimen';
import * as primary_diagnosis from './primary_diagnosis';
import * as follow_up from './followUp';
// this done because typescript doesn't allow mapping with string index signature for default export
export const submissionValidator: { [k: string]: any } = {
  donor,
  primary_diagnosis,
  specimen,
  follow_up,
};
