import clinicalRegistrationResolver from './clinical-resolvers/clinicalRegistrationData';
import clinicalSearchResultResolver from './clinical-resolvers/clinicalSearchResults';
import clinicalSubmissionResolver from './clinical-resolvers/clinicalSubmissionDataResolver';

const resolvers = {
  Query: {
    ...clinicalRegistrationResolver,
    ...clinicalSearchResultResolver,
    ...clinicalSubmissionResolver,
  },
};

export default resolvers;
