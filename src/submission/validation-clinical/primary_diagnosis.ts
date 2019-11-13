import {
  SubmissionValidationError,
  RecordValidationResult,
  SubmittedClinicalRecordsMap,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { ClinicalSubmissionRecordsOperations as organizerOperations } from './utils';

export const validate = async (
  submittedRecords: DeepReadonly<SubmittedClinicalRecordsMap>,
  existentDonor: DeepReadonly<Donor>,
): Promise<RecordValidationResult> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  const primaryDiagnosisRecord = organizerOperations.getPrimaryDiagnosisRecord(submittedRecords);
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
