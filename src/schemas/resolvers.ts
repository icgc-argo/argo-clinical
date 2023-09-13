import clinicalRegistrationResolver from './clinical-resolvers/clinicalRegistrationData';
import clinicalSearchResultResolver from './clinical-resolvers/clinicalSearchResults';
import clinicalSubmissionResolver from './clinical-resolvers/clinicalSubmissionDataResolver';
import clearClinicalSubmissionResolver from './clinical-resolvers/clearClinicalSubmissionResolver';
import validateClinicalSubmissionResolver from './clinical-resolvers/validateClinicalSubmissionResolver';

const resolvers = {
  Query: {
    ...clinicalRegistrationResolver,
    ...clinicalSearchResultResolver,
    ...clinicalSubmissionResolver,
  },
  Mutation: {
    ...clearClinicalSubmissionResolver,
    ...validateClinicalSubmissionResolver,
  },
};

export default resolvers;
