/*const resolvers = {
  Query: {
    clinicalRegistration: () => 'Test',
  },
};
*/

const nameResolver = {
  Query: {
    hello: () => 'World',
    name: () => 'UK',
  },
};

const resolvers = {
  ...nameResolver,
};

export default resolvers;
