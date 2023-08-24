import { getClinicalSearchResults, ClinicalSearchVariables } from '../../clinical/clinical-service';

const clinicalSearchResultResolver = {
  clinicalSearchResults: async (obj: unknown, args: ClinicalSearchVariables) => {
    const { programShortName, filters } = args;

    const searchResults = (await getClinicalSearchResults(programShortName, filters)) || {
      searchResults: [],
    };

    return { ...searchResults, programShortName };
  },
};

export default clinicalSearchResultResolver;
