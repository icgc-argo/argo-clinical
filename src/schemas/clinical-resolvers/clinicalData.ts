import { getPaginatedClinicalData, ClinicalDataVariables } from '../../clinical/clinical-service';

const clinicalDataResolver = {
  clinicalData: async (obj: unknown, args: ClinicalDataVariables) => {
    const { programShortName, filters } = args;

    const clinicalEntities = (await getPaginatedClinicalData(programShortName, filters)) || {
      clinicalEntities: [],
    };

    const formattedEntityData = {
      programShortName,
      clinicalEntities,
    };

    return formattedEntityData;
  },
};

export default clinicalDataResolver;
