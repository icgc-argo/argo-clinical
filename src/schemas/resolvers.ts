import clinicalRegistrationResolver from './clinicalRegistrationDataResolver';
import clinicalSubmissionResolver from './clinicalSubmissionDataResolver';

const resolvers = {
  ...clinicalRegistrationResolver,
  ...clinicalSubmissionResolver,
};

export default resolvers;
