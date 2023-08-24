import { getClinicalData, ClinicalSearchVariables } from '../../clinical/clinical-service';

const clinicalDataResolver = {
  clinicalData: async (obj: unknown, args: ClinicalSearchVariables) => {
    const { programShortName } = args;
    const clinicalEntities = await getClinicalData(programShortName);

    const formattedEntityData = {
      programShortName,
      clinicalEntities,
    };

    return formattedEntityData;
  },
};

export default clinicalDataResolver;
