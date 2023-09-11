import { commitRegistration } from '../../submission/submission-to-clinical/submission-to-clinical';
import { get } from 'lodash';

const commitClinicalRegistration = async (
  obj: unknown,
  args: { shortName: string; registrationId: string },
) => {
  const { shortName: programId, registrationId } = args;

  const response = await commitRegistration({
    registrationId,
    programId,
  });

  return get(response, 'newSamples', []);
};

export default commitClinicalRegistration;
