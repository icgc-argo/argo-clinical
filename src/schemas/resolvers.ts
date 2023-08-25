import clinicalDataResolver from './clinical-resolvers/clinicalData';
import clinicalRegistrationResolver from './clinical-resolvers/clinicalRegistrationData';
import clinicalSearchResultResolver from './clinical-resolvers/clinicalSearchResults';

const resolvers = {
  Query: {
    ...clinicalDataResolver,
    ...clinicalRegistrationResolver,
    ...clinicalSearchResultResolver,
  },
};

export default resolvers;
