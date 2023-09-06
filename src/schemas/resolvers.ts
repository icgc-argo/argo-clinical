import { GraphQLResolverMap } from '@apollo/subgraph/src/schema-helper';

import clinicalDataResolver from './clinical-resolvers/clinicalData';
import clinicalErrorsResolver from './clinical-resolvers/clinicalErrors';
import clinicalRegistrationResolver from './clinical-resolvers/clinicalRegistrationData';
import clinicalSearchResultResolver from './clinical-resolvers/clinicalSearchResults';
import clinicalSubmissionResolver from './clinical-resolvers/clinicalSubmissionDataResolver';

const resolvers: GraphQLResolverMap<unknown> = {
  Query: {
    ...clinicalDataResolver,
    ...clinicalErrorsResolver,
    ...clinicalRegistrationResolver,
    ...clinicalSearchResultResolver,
    ...clinicalSubmissionResolver,
  },
};

export default resolvers;
