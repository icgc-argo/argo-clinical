import { getClinicalSearchResults, ClinicalSearchQuery } from '../clinical/clinical-service';

// Query Arguments
type ClinicalVariables = {
  programShortName: string;
  filters: ClinicalSearchQuery;
};

const clinicalResolvers = {
  Query: {
    clinicalRegistration: () => {
      console.log('clinicalRegistration resolver');
    },
    clinicalSearchResults: async (obj: unknown, args: ClinicalVariables) => {
      const { programShortName, filters } = args;

      const searchResults = (await getClinicalSearchResults(programShortName, filters)) || {
        searchResults: [],
      };

      return { ...searchResults, programShortName };
    },
  },
};

const resolvers = {
  ...clinicalResolvers,
};

export default resolvers;
