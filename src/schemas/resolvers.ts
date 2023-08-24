import clinicalRegistrationResolver from './clinical-resolvers/clinicalRegistrationData';
import clinicalSearchResultResolver from './clinical-resolvers/clinicalSearchResults';

const resolvers = {
  Query: {
    ...clinicalRegistrationResolver,
    ...clinicalSearchResultResolver,
  },
};

export default resolvers;
