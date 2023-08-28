import { GraphQLResolverMap } from '@apollo/subgraph/src/schema-helper';

import clinicalDataResolver, {
  nestedClinicalErrorResolver,
} from './clinical-resolvers/clinicalData';
import clinicalErrorsResolver from './clinical-resolvers/clinicalErrors';
import clinicalRegistrationResolver from './clinical-resolvers/clinicalRegistrationData';
import clinicalSearchResultResolver from './clinical-resolvers/clinicalSearchResults';

const resolvers: GraphQLResolverMap<unknown> = {
  Query: {
    ...clinicalDataResolver,
    ...clinicalErrorsResolver,
    ...clinicalRegistrationResolver,
    ...clinicalSearchResultResolver,
  },
  ...nestedClinicalErrorResolver,
};

export default resolvers;
