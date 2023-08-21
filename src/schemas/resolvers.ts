const clinicalRegistrationResolver = {
  Query: {
    clinicalRegistration: () => {
      console.log('clinicalRegistration resolver');
    },
  },
};

const resolvers = {
  ...clinicalRegistrationResolver,
};

export default resolvers;
