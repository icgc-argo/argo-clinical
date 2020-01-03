import {
  SubmissionValidationError,
  RecordValidationResult,
  ClinicalEntitySchemaNames,
  TreatmentFieldsEnum,
  SubmittedClinicalRecord,
  DataValidationErrors,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Treatment } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { getSingleClinicalObjectFromDonor } from '../submission-to-clinical/submission-to-clinical';

export const validate = async (
  chemoRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<SubmissionValidationError[]> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  if (!chemoRecord || !mergedDonor || !existentDonor) {
    throw new Error("Can't call this function without a registerd donor & therapy record");
  }

  const errors: SubmissionValidationError[] = [];

  const treatment = getTreatment(chemoRecord, mergedDonor, errors);
  if (!treatment) return errors;

  checkTreatementHasCorrectType(chemoRecord, treatment, errors);

  return errors;
};

function checkTreatementHasCorrectType(
  chemoRecord: SubmittedClinicalRecord,
  treatment: DeepReadonly<Treatment>,
  errors: SubmissionValidationError[],
) {
  const treatmentType = treatment.clinicalInfo[TreatmentFieldsEnum.treatment_type] as string;
  if (utils.treatmentTypeIsNotChemo(treatmentType)) {
    errors.push(
      utils.buildSubmissionError(
        chemoRecord,
        DataValidationErrors.INCOMPATIBLE_PARENT_TREATMENT_TYPE,
        TreatmentFieldsEnum.submitter_treatment_id,
        {
          [TreatmentFieldsEnum.treatment_type]: treatmentType,
        },
      ),
    );
  }
}

function getTreatment(
  chemoRecord: SubmittedClinicalRecord,
  mergedDonor: Donor,
  errors: SubmissionValidationError[],
) {
  const treatmentId = chemoRecord[TreatmentFieldsEnum.submitter_treatment_id];
  const treatment = getSingleClinicalObjectFromDonor(
    mergedDonor,
    ClinicalEntitySchemaNames.TREATMENT,
    { clinicalInfo: { [TreatmentFieldsEnum.submitter_treatment_id]: treatmentId as string } },
  ) as DeepReadonly<Treatment>;
  if (!treatment || treatment.clinicalInfo === {}) {
    errors.push(
      utils.buildSubmissionError(
        chemoRecord,
        DataValidationErrors.TREATMENT_ID_NOT_FOUND,
        TreatmentFieldsEnum.submitter_treatment_id,
      ),
    );
    return undefined;
  }

  return treatment;
}
