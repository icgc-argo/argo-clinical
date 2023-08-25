import { getClinicalErrors } from '../../clinical/clinical-service';

const clinicalErrorResolver = {
  clinicalErrors: async (obj: unknown, args: { programShortName: string; donorIds: number[] }) => {
    const { clinicalErrors } = await getClinicalErrors(args.programShortName, args.donorIds);

    return clinicalErrors;
  },
};

export default clinicalErrorResolver;
