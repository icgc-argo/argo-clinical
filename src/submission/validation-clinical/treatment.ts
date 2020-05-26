import {
  SubmissionValidationError,
  SubmittedClinicalRecord,
  DataValidationErrors,
} from '../submission-entities';
import {
  ClinicalEntitySchemaNames,
  ClinicalUniqueIdentifier,
  TreatmentFieldsEnum,
  ClinicalTherapyType,
  ClinicalTherapySchemaNames,
} from '../../common-model/entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Treatment } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { getSingleClinicalObjectFromDonor } from '../../common-model/functions';
import { checkClinicalEntityDoesntBelongToOtherDonor, checkRelatedEntityExists } from './utils';

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

  // order is important here if the previous treatment is good we take time
  // to validate therapies
  const validateTherapies = errors.length == 0;
  if (validateTherapies) {
    for (const therapyName of ClinicalTherapySchemaNames) {
      checkTherapyFileNeeded(treatmentRecord, mergedDonor, therapyName, errors);
    }
  }

  // validate primary diagnosis exists
  checkRelatedEntityExists(
    ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
    treatmentRecord,
    ClinicalEntitySchemaNames.TREATMENT,
    mergedDonor,
    errors,
    true,
  );
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
    await checkClinicalEntityDoesntBelongToOtherDonor(
      ClinicalEntitySchemaNames.TREATMENT,
      treatmentRecord,
      existentDonor,
      errors,
    );
  }
}

function checkTherapyFileNeeded(
  treatmentRecord: SubmittedClinicalRecord,
  mergedDonor: Donor,
  therapyType: ClinicalTherapyType,
  errors: SubmissionValidationError[],
) {
  const treatmentType = treatmentRecord[TreatmentFieldsEnum.treatment_type] as string;
  if (utils.treatmentTypeNotMatchTherapyType(treatmentType, therapyType)) return;

  const treatment = getTreatment(treatmentRecord, mergedDonor);
  if (!treatment) throw new Error('Missing treatment, shouldnt be possible');

  if (
    treatment.therapies.length === 0 ||
    !treatment.therapies.some(th => th.therapyType === therapyType)
  ) {
    errors.push(
      utils.buildSubmissionError(
        treatmentRecord,
        DataValidationErrors.MISSING_THERAPY_DATA,
        TreatmentFieldsEnum.treatment_type,
        { therapyType },
      ),
    );
  }
}

function getTreatment(treatmentRecord: SubmittedClinicalRecord, donor: DeepReadonly<Donor>) {
  const idFieldName = ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.TREATMENT];
  const treatmentId = treatmentRecord[idFieldName];

  return getSingleClinicalObjectFromDonor(donor, ClinicalEntitySchemaNames.TREATMENT, {
    clinicalInfo: { [idFieldName]: treatmentId as string },
  }) as DeepReadonly<Treatment>;
}
