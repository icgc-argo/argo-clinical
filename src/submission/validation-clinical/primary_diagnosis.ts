// this file will be deleted after stats are refactored out of validate
import {
  SubmissionValidationError,
  RecordValidationResult,
  SubmittedClinicalRecord,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import * as utils from './utils';

export const validate = async (
  primaryDiagnosisRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
): Promise<RecordValidationResult> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  if (!primaryDiagnosisRecord || !existentDonor) {
    throw new Error("Can't call this function without donor & primary_diagnosis record");
  }

  // ***Submission Validation checks**
  const errors: SubmissionValidationError[] = []; // all errors for record

  // comming soon...

  return utils.buildRecordValidationResult(
    primaryDiagnosisRecord,
    errors,
    existentDonor.primaryDiagnosis,
  );
};
