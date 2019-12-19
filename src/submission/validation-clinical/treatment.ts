import {
  SubmissionValidationError,
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
import { checkClinicalEntityDoesntBelongsToOtherDonor } from './utils';

export const validate = async (
  treatmentRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<SubmissionValidationError[]> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  if (!treatmentRecord || !existentDonor || !mergedDonor) {
    throw new Error("Can't call this function without a registerd donor & treatment record");
  }

  const errors: SubmissionValidationError[] = [];

  await checkTreatmentDoesntBelongToOtherDonor(treatmentRecord, existentDonor, errors);

  if (errors.length > 0) return errors;

  checkChemoFileNeeded(treatmentRecord, mergedDonor, errors);

  return errors;
};

async function checkTreatmentDoesntBelongToOtherDonor(
  treatmentRecord: SubmittedClinicalRecord,
  existentDonor: DeepReadonly<Donor>,
  errors: SubmissionValidationError[],
) {
  const treatment = getTreatment(treatmentRecord, existentDonor);
  // if treatment isn't present in this existentDonor, it could exist in another donor
  if (!treatment) {
    await checkClinicalEntityDoesntBelongsToOtherDonor(
      ClinicalEntitySchemaNames.TREATMENT,
      treatmentRecord,
      existentDonor,
      errors,
    );
  }
}

function checkChemoFileNeeded(
  treatmentRecord: SubmittedClinicalRecord,
  mergedDonor: Donor,
  errors: SubmissionValidationError[],
) {
  const treatmentType = treatmentRecord[TreatmentFieldsEnum.treatment_type] as string;
  if (utils.treatmentTypeIsNotChemo(treatmentType)) return;

  const treatment = getTreatment(treatmentRecord, mergedDonor);
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

function getTreatment(treatmentRecord: SubmittedClinicalRecord, donor: DeepReadonly<Donor>) {
  const idFieldName = ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.TREATMENT];
  const treatmentId = treatmentRecord[idFieldName];

  return getSingleClinicalObjectFromDonor(donor, ClinicalEntitySchemaNames.TREATMENT, {
    clinicalInfo: { [idFieldName]: treatmentId as string },
  }) as DeepReadonly<Treatment>;
}
