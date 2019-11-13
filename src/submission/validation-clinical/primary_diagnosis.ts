import {
  FieldsEnum,
  DataValidationErrors,
  SubmittedClinicalRecord,
  SubmissionValidationError,
  RecordValidationResult,
  ModificationType,
  ClinicalEntityType,
  DonorRecordsOrganizer,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';

export const validate = async (
  recordOrganizer: DonorRecordsOrganizer,
  existentDonor: DeepReadonly<Donor>,
): Promise<RecordValidationResult> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  const pdRecord = recordOrganizer.getPrimaryDiagnosesRecord();
  if (!pdRecord || !existentDonor) {
    throw new Error("Can't call this function without donor & primary_diagnosis record");
  }

  // ***Submission Validation checks**
  const errors: SubmissionValidationError[] = []; // all errors for record

  // comming soon...

  return utils.buildRecordValidationResult(pdRecord, errors, existentDonor.primaryDiagnosis);
};
