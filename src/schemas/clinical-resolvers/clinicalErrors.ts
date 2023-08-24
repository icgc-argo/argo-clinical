import { getClinicalErrors } from '../../clinical/clinical-service';

const clinicalErrorResolver = {
  clinicalErrors: async (obj: unknown, args: { programShortName: string; donorIds: number[] }) => {
    const errorResponse = await getClinicalErrors(args.programShortName, args.donorIds);

    return errorResponse;
  },
};

export default clinicalErrorResolver;
