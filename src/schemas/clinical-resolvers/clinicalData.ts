import { getPaginatedClinicalData, ClinicalDataVariables } from '../../clinical/clinical-service';
import { ClinicalEntityData, ClinicalInfo } from '../../clinical/clinical-entities';
import { ClinicalErrorsResponseRecord } from '../../common-model/entities';
import { errorResolver } from './clinicalErrors';

export type ClinicalEntityGQLData = {
  programShortName: string;
  clinicalEntities: ClinicalEntityDisplayData[];
};

// FE Clinical Data Query Response Payload
export type ClinicalEntityDataResponse = ClinicalEntityGQLData & {
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
        for (const [name, val] of Object.entries(record)) {
          if (name === 'submitter_id') continue;
          const value = Array.isArray(val) ? val.join(', ') : JSON.stringify(val);
          displayRecords.push({ name, value });
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

    const clinicalEntityData = convertClinicalDataToGql(programShortName, clinicalEntities);

    const { clinicalErrors } = await errorResolver(clinicalEntityData, {
      programShortName,
      donorIds: [],
    });

    const clinicalData: ClinicalEntityDataResponse = {
      ...clinicalEntityData,
      clinicalErrors,
    };

    return clinicalData;
  },
};

export default clinicalDataResolver;
