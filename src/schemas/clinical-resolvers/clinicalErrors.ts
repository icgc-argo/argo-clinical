import { getClinicalErrors } from '../../clinical/clinical-service';
import { ClinicalEntityDataResponse } from './clinicalData';

export const errorResolver = async (
  parent: ClinicalEntityDataResponse,
  args: { programShortName: string; donorIds: number[] },
) => {
  const programId = args.programShortName || parent.programShortName;
  const parentDonorIds: number[] = [];

  parent.clinicalEntities.forEach(entity =>
    entity.records.forEach(displayRecord => {
      const { donor_id } = displayRecord;
      if (typeof donor_id === 'number') parentDonorIds.push(donor_id);
    }),
  );

  const donorIds = args?.donorIds?.length ? args.donorIds : parentDonorIds;

  const { clinicalErrors } = await getClinicalErrors(programId, donorIds);

  return clinicalErrors;
};

const clinicalErrorResolver = {
  clinicalErrors: errorResolver,
};

export default clinicalErrorResolver;
