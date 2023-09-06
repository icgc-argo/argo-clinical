import { getClinicalErrors } from '../../clinical/clinical-service';
import { ClinicalEntityGQLData } from './clinicalData';

export const errorResolver = async (
  parent: ClinicalEntityGQLData,
  args: { programShortName: string; donorIds: number[] },
) => {
  const programId = args.programShortName || parent.programShortName;
  const parentDonorIds: number[] = [];

  parent.clinicalEntities.forEach(entity =>
    entity.records.forEach(displayRecord => {
      const donor = displayRecord.find(({ name }) => name === 'donor_id');
      if (donor && donor.value) {
        const donorId = parseInt(donor.value);
        parentDonorIds.push(donorId);
      }
    }),
  );

  const donorIds = args?.donorIds?.length ? args.donorIds : parentDonorIds;

  const clinicalErrors = await getClinicalErrors(programId, donorIds);

  return clinicalErrors;
};

const clinicalErrorResolver = {
  clinicalErrors: errorResolver,
};

export default clinicalErrorResolver;
