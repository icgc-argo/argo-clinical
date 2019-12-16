import {
  SubmissionValidationError,
  RecordValidationResult,
  ClinicalEntitySchemaNames,
  TreatmentFieldsEnum,
  SubmittedClinicalRecord,
  DataValidationErrors,
  ClinicalUniqueIndentifier,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Treatment } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { getSingleClinicalObjectFromDonor } from '../submission-to-clinical/submission-to-clinical';

export const validate = async (
  treatmentRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<RecordValidationResult> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  if (!treatmentRecord || !existentDonor || !mergedDonor) {
    throw new Error("Can't call this function without a registerd donor & treatment record");
  }

  const errors: SubmissionValidationError[] = [];

  checkChemoFileNeeded(treatmentRecord, mergedDonor, errors);

  // leaving this for now, stats will me moved out of validate so this won't be needed
  const treatmentClinicalInfo = getTreatmentClinicalInfo(existentDonor, treatmentRecord);
  return utils.buildRecordValidationResult(treatmentRecord, errors, treatmentClinicalInfo);
};

// same here
function getTreatmentClinicalInfo(
  existentDonor: DeepReadonly<Donor>,
  treatmentRecord: SubmittedClinicalRecord,
) {
  const idFieldName = ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.TREATMENT];
  const treatment_id = treatmentRecord[idFieldName];
  return (existentDonor.treatments || []).find(tr => tr.clinicalInfo[idFieldName] === treatment_id);
}

function checkChemoFileNeeded(
  treatmentRecord: SubmittedClinicalRecord,
  mergedDonor: Donor,
  errors: SubmissionValidationError[],
) {
  const idFieldName = ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.TREATMENT];
  const treatmentType = treatmentRecord[TreatmentFieldsEnum.treatment_type] as string;
  if (utils.treatmentTypeIsNotChemo(treatmentType)) {
    return;
  }

  const treatmentId = treatmentRecord[idFieldName];
  const treatment = getSingleClinicalObjectFromDonor(
    mergedDonor,
    ClinicalEntitySchemaNames.TREATMENT,
    { clinicalInfo: { [idFieldName]: treatmentId as string } },
  ) as DeepReadonly<Treatment>;
  if (!treatment) throw new Error('Missing treatment, shouldnt be possible');

  if (
    treatment.therapies.length === 0 ||
    !treatment.therapies.some(th => th.therapyType === ClinicalEntitySchemaNames.CHEMOTHERAPY)
  ) {
    errors.push(
      utils.buildSubmissionError(
        treatmentRecord,
        DataValidationErrors.MISSING_THERAPY_DATA,
        TreatmentFieldsEnum.treatment_type,
        {
          therapyType: ClinicalEntitySchemaNames.CHEMOTHERAPY,
        },
      ),
    );
  }
}
