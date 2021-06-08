import { DeepReadonly } from 'deep-freeze';
import { ClinicalEntitySchemaNames } from '../../common-model/entities';
import {
  SubmissionValidationError,
  SubmissionValidationOutput,
  SubmittedClinicalRecord,
} from '../submission-entities';
import { Donor } from '../../clinical/clinical-entities';
import * as utils from './utils';

export const validate = async (
  biomarkerRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<SubmissionValidationOutput> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  if (!biomarkerRecord || !mergedDonor || !existentDonor) {
    throw new Error("Can't call this function without a registerd donor & therapy record");
  }

  const errors: SubmissionValidationError[] = [];
  utils.checkRelatedEntityExists(
    ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
    biomarkerRecord,
    ClinicalEntitySchemaNames.BIOMARKER,
    mergedDonor,
    errors,
    false,
  );

  utils.checkRelatedEntityExists(
    ClinicalEntitySchemaNames.SPECIMEN,
    biomarkerRecord,
    ClinicalEntitySchemaNames.BIOMARKER,
    mergedDonor,
    errors,
    false,
  );

  utils.checkRelatedEntityExists(
    ClinicalEntitySchemaNames.TREATMENT,
    biomarkerRecord,
    ClinicalEntitySchemaNames.BIOMARKER,
    mergedDonor,
    errors,
    false,
  );

  utils.checkRelatedEntityExists(
    ClinicalEntitySchemaNames.FOLLOW_UP,
    biomarkerRecord,
    ClinicalEntitySchemaNames.BIOMARKER,
    mergedDonor,
    errors,
    false,
  );

  return { errors };
};
