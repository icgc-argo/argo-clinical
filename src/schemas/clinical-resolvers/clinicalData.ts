import { getPaginatedClinicalData, ClinicalDataVariables } from '../../clinical/clinical-service';
import { ClinicalEntityData, ClinicalInfo } from '../../clinical/clinical-entities';
import { ClinicalErrorsResponseRecord } from '../../common-model/entities';
import { errorResolver } from './clinicalErrors';

// FE Query Response Payload
export type ClinicalEntityDataResponse = {
  programShortName: string;
  clinicalEntities: ClinicalEntityDisplayData[];
  clinicalErrors?: ClinicalErrorsResponseRecord[];
};

// GQL Formatting
type EntityDisplayRecord = { name: string; value: string };

interface ClinicalEntityDisplayData extends Omit<ClinicalEntityData, 'records'> {
  records: EntityDisplayRecord[][];
}

const convertClinicalDataToGql = (
  programShortName: string,
  clinicalEntities: ClinicalEntityData[],
) => {
  const clinicalDisplayData: ClinicalEntityDisplayData[] = clinicalEntities.map(
    (entity: ClinicalEntityData) => {
      const records: EntityDisplayRecord[][] = [];

      entity.records.forEach((record: ClinicalInfo) => {
        const displayRecords: EntityDisplayRecord[] = [];
        for (const [key, val] of Object.entries(record)) {
          const name = key === 'submitter_id' ? false : key;
          const value = name && Array.isArray(val) ? val.join(', ') : JSON.stringify(val);
          if (name) displayRecords.push({ name, value });
        }
        records.push(displayRecords);
      });

      const entityData: ClinicalEntityDisplayData = {
        ...entity,
        records,
      };

      return entityData;
    },
  );

  const clinicalData = {
    programShortName,
    clinicalEntities: clinicalDisplayData,
  };

  return clinicalData;
};

const clinicalDataResolver = {
  clinicalData: async (obj: unknown, args: ClinicalDataVariables) => {
    const { programShortName, filters } = args;

    const { clinicalEntities } = await getPaginatedClinicalData(programShortName, filters);

    const formattedEntityData = convertClinicalDataToGql(programShortName, clinicalEntities);

    return formattedEntityData;
  },
};

export const nestedClinicalErrorResolver = {
  ClinicalData: {
    clinicalErrors: errorResolver,
  },
};

export default clinicalDataResolver;
