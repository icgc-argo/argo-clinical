import {
  SubmissionValidationError,
  RecordValidationResult,
  SubmittedClinicalRecordsMap,
  ClinicalEntitySchemaNames,
  SubmittedClinicalRecord,
  FollowupFieldsEnum,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, FollowUp } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { ClinicalSubmissionRecordsOperations } from './utils';
import { getClinicalEntitiesFromDonorBySchemaName } from '../submission-to-clinical/submission-to-clinical';

export const validate = async (
  submittedRecords: DeepReadonly<SubmittedClinicalRecordsMap>,
  existentDonor: DeepReadonly<Donor>,
): Promise<RecordValidationResult[]> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  const followUpRecords = ClinicalSubmissionRecordsOperations.getArrayRecords(
    ClinicalEntitySchemaNames.FOLLOW_UP,
    submittedRecords,
  );

  if (followUpRecords.length === 0 || !existentDonor) {
    throw new Error("Can't call this function without followup records");
  }

  const recordValidationResults: RecordValidationResult[] = [];

  for (const followUpRecord of followUpRecords) {
    const errors: SubmissionValidationError[] = [];
    const followUpClinicalInfo = getExistingFollowUp(existentDonor, followUpRecord);
    recordValidationResults.push(
      utils.buildRecordValidationResult(followUpRecord, errors, followUpClinicalInfo),
    );
  }

  return recordValidationResults;
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
