import {
  SubmissionValidationError,
  ClinicalEntitySchemaNames,
  SubmittedClinicalRecord,
  FollowupFieldsEnum,
  ClinicalUniqueIndentifier,
  DataValidationErrors,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { getClinicalEntitiesFromDonorBySchemaName } from '../submission-to-clinical/submission-to-clinical';
import { donorDao } from '../../clinical/donor-repo';

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
    const alreadyAssociatedDonor = await donorDao.findByFollowUpSubmitterIdAndProgramId({
      programId: existentDonor.programId,
      submitterId: followUpRecord[
        ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.FOLLOW_UP]
      ] as string,
    });

    if (alreadyAssociatedDonor) {
      errors.push(
        utils.buildSubmissionError(
          followUpRecord,
          DataValidationErrors.FOLLOWUP_BELONGS_TO_OTHER_DONOR,
          FollowupFieldsEnum.submitter_follow_up_id,
          {
            otherDonorSubmitterId: alreadyAssociatedDonor.submitterId,
          },
        ),
      );
    }
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
