import clinicalRegistrationResolver from './clinical-resolvers/clinicalRegistrationData';
import clinicalSearchResultResolver from './clinical-resolvers/clinicalSearchResults';
import clinicalSubmissionResolver from './clinical-resolvers/clinicalSubmissionDataResolver';
import clearClinicalSubmissionResolver from './clinical-resolvers/clearClinicalSubmissionResolver';
import validateClinicalSubmissionResolver from './clinical-resolvers/validateClinicalSubmissionResolver';
import commitClinicalSubmissionResolver from './clinical-resolvers/commitClinicalSubmission';

const resolvers = {
  Query: {
    ...clinicalRegistrationResolver,
    ...clinicalSearchResultResolver,
    ...clinicalSubmissionResolver,
  },
  Mutation: {
    ...clearClinicalSubmissionResolver,
    ...validateClinicalSubmissionResolver,
    ...commitClinicalSubmissionResolver,
  },
};

export default resolvers;
