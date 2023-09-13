import { getClinicalSearchResults, ClinicalSearchQuery } from '../../clinical/clinical-service';

// Query Arguments
type ClinicalVariables = {
  programShortName: string;
  filters: ClinicalSearchQuery;
};

const clinicalSearchResultResolver = {
  clinicalSearchResults: async (obj: unknown, args: ClinicalVariables) => {
    const { programShortName, filters } = args;

    const searchResults = (await getClinicalSearchResults(programShortName, filters)) || {
      searchResults: [],
    };

    return { ...searchResults, programShortName };
  },
};

export default clinicalSearchResultResolver;
