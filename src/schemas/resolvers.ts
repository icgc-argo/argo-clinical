import clinicalRegistrationResolver from './clinical-resolvers/clinicalRegistrationData';
import clinicalSearchResultResolver from './clinical-resolvers/clinicalSearchResults';
import clinicalSubmissionResolver from './clinical-resolvers/clinicalSubmissionData';
import clearClinicalSubmissionResolver from './clinical-resolvers/clearClinicalSubmission';
import validateClinicalSubmissionResolver from './clinical-resolvers/validateClinicalSubmission';
import commitClinicalSubmissionResolver from './clinical-resolvers/commitClinicalSubmission';
import reopenClinicalSubmissionResolver from './clinical-resolvers/reopenClinicalSubmission';

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
    ...reopenClinicalSubmissionResolver,
  },
};

export default resolvers;
