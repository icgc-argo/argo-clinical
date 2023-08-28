import { getPaginatedClinicalData, ClinicalDataVariables } from '../../clinical/clinical-service';
import { ClinicalEntityData } from '../../clinical/clinical-entities';
import { ClinicalErrorsResponseRecord } from '../../common-model/entities';
import { errorResolver } from './clinicalErrors';

// FE Query Response Payload
export type ClinicalEntityDataResponse = {
  programShortName: string;
  clinicalEntities: ClinicalEntityData[];
  clinicalErrors?: ClinicalErrorsResponseRecord[];
};

const clinicalDataResolver = {
  clinicalData: async (obj: unknown, args: ClinicalDataVariables) => {
    const { programShortName, filters } = args;

    const { clinicalEntities } = await getPaginatedClinicalData(programShortName, filters);

    const formattedEntityData: ClinicalEntityDataResponse = {
      programShortName,
      clinicalEntities,
    };

    return formattedEntityData;
  },
};

export const nestedClinicalErrorResolver = {
  ClinicalData: {
    clinicalErrors: errorResolver,
  },
};

export default clinicalDataResolver;
