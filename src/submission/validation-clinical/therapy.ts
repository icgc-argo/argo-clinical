import {
  SubmissionValidationError,
  ClinicalEntitySchemaNames,
  TreatmentFieldsEnum,
  SubmittedClinicalRecord,
  DataValidationErrors,
  ClinicalTherapyType,
  TherapyRxNormFields,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Treatment } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { getSingleClinicalObjectFromDonor } from '../submission-to-clinical/submission-to-clinical';

export const validate = async (
  therapyRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<SubmissionValidationError[]> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  if (!therapyRecord || !mergedDonor || !existentDonor) {
    throw new Error("Can't call this function without a registerd donor & therapy record");
  }

  const errors: SubmissionValidationError[] = [];
  const treatment = getTreatment(therapyRecord, mergedDonor, errors);
  if (!treatment) return errors;
  checkTreatementHasCorrectTypeForTherapy(therapyRecord, treatment, errors);
  return errors;
};

function checkTreatementHasCorrectTypeForTherapy(
  therapyRecord: SubmittedClinicalRecord,
  treatment: DeepReadonly<Treatment>,
  errors: SubmissionValidationError[],
) {
  const treatmentType = treatment.clinicalInfo[TreatmentFieldsEnum.treatment_type] as string;
  const therapyType = treatment.therapies.find(therapy => therapy.clinicalInfo === therapyRecord)
    ?.therapyType;

  if (utils.treatmentTypeNotMatchTherapyType(treatmentType, therapyType as ClinicalTherapyType)) {
    errors.push(
      utils.buildSubmissionError(
        therapyRecord,
        DataValidationErrors.INCOMPATIBLE_PARENT_TREATMENT_TYPE,
        TreatmentFieldsEnum.submitter_treatment_id,
        {
          [TreatmentFieldsEnum.treatment_type]: treatmentType,
          therapyType,
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
