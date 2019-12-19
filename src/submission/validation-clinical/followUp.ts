import {
  SubmissionValidationError,
  ClinicalEntitySchemaNames,
  SubmittedClinicalRecord,
  FollowupFieldsEnum,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import _ from 'lodash';
import { getClinicalEntitiesFromDonorBySchemaName } from '../submission-to-clinical/submission-to-clinical';
import { checkClinicalEntityDoesntBelongsToOtherDonor } from './utils';

export const validate = async (
  followUpRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
): Promise<SubmissionValidationError[]> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  if (!followUpRecord || !existentDonor) {
    throw new Error("Can't call this function without followup records");
  }

  const errors: SubmissionValidationError[] = [];
  const followUpClinicalInfo = getExistingFollowUp(existentDonor, followUpRecord);

  // adding new follow up to this donor ?
  if (!followUpClinicalInfo) {
    // check it is unique in this program
    await checkClinicalEntityDoesntBelongsToOtherDonor(
      ClinicalEntitySchemaNames.FOLLOW_UP,
      followUpRecord,
      existentDonor,
      errors,
    );
  }

  return errors;
};

function getExistingFollowUp(
  existingDonor: DeepReadonly<Donor>,
  record: DeepReadonly<SubmittedClinicalRecord>,
) {
  if (existingDonor.followUps) {
    return getClinicalEntitiesFromDonorBySchemaName(
      existingDonor,
      ClinicalEntitySchemaNames.FOLLOW_UP,
    ).find(
      ci =>
        ci[FollowupFieldsEnum.submitter_follow_up_id] ==
        record[FollowupFieldsEnum.submitter_follow_up_id],
    );
  }
  return undefined;
}
