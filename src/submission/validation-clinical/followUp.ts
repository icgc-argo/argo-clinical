import {
  SubmissionValidationError,
  SubmittedClinicalRecord,
  DataValidationErrors,
} from '../submission-entities';
import {
  ClinicalEntitySchemaNames,
  FollowupFieldsEnum,
  ClinicalUniqueIdentifier,
  PrimaryDiagnosisFieldsEnum,
} from '../../common-model/entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import _ from 'lodash';
import { getClinicalEntitiesFromDonorBySchemaName } from '../../common-model/functions';
import { checkClinicalEntityDoesntBelongToOtherDonor, checkRelatedEntityExists } from './utils';

export const validate = async (
  followUpRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<SubmissionValidationError[]> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  if (!followUpRecord || !existentDonor) {
    throw new Error("Can't call this function without followup records");
  }
  const errors: SubmissionValidationError[] = [];

  // check if a primary diagnosis is specified that it exists
  checkRelatedEntityExists(
    ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
    followUpRecord,
    mergedDonor,
    errors,
    false,
  );

  // check if a treatment is specified that it exists
  checkRelatedEntityExists(
    ClinicalEntitySchemaNames.TREATMENT,
    followUpRecord,
    mergedDonor,
    errors,
    false,
  );

  const followUpClinicalInfo = getExistingFollowUp(existentDonor, followUpRecord);
  // adding new follow up to this donor ?
  if (!followUpClinicalInfo) {
    // check it is unique in this program
    await checkClinicalEntityDoesntBelongToOtherDonor(
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
