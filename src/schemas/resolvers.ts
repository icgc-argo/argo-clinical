import clinicalDataResolver from './clinical-resolvers/clinicalData';
import clinicalErrorsResolver from './clinical-resolvers/clinicalErrors';
import clinicalRegistrationResolver from './clinical-resolvers/clinicalRegistrationData';
import clinicalSearchResultResolver from './clinical-resolvers/clinicalSearchResults';

const resolvers = {
  Query: {
    ...clinicalDataResolver,
    ...clinicalErrorsResolver,
    ...clinicalRegistrationResolver,
    ...clinicalSearchResultResolver,
  },
};

export default resolvers;
