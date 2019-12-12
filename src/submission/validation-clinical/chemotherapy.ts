import {
  SubmissionValidationError,
  RecordValidationResult,
  SubmittedClinicalRecordsMap,
  ClinicalEntitySchemaNames,
  TreatmentFieldsEnum,
  SubmittedClinicalRecord,
  DataValidationErrors,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Treatment } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { ClinicalSubmissionRecordsOperations } from './utils';
import { getSingleClinicalObjectFromDonor } from '../submission-to-clinical/submission-to-clinical';

export const validate = async (
  submittedRecords: DeepReadonly<SubmittedClinicalRecordsMap>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<RecordValidationResult[]> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  const submittedChemotherapyRecords = ClinicalSubmissionRecordsOperations.getArrayRecords(
    ClinicalEntitySchemaNames.CHEMOTHERAPY,
    submittedRecords,
  );
  if (!submittedChemotherapyRecords || !existentDonor) {
    throw new Error("Can't call this function without a registerd donor & treatment record");
  }

  const recordValidationResults: RecordValidationResult[] = [];
  for (const chemoRecord of submittedChemotherapyRecords) {
    const treatment = getTreatment(chemoRecord, mergedDonor, recordValidationResults);
    if (!treatment) continue;

    const errors: SubmissionValidationError[] = [];

    checkTreatementHasCorrectType(chemoRecord, treatment, errors);

    recordValidationResults.push(
      utils.buildRecordValidationResult(chemoRecord, errors, existentDonor.primaryDiagnosis),
    );
  }

  return recordValidationResults;
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
  validationResults: RecordValidationResult[],
) {
  const treatmentId = chemoRecord[TreatmentFieldsEnum.submitter_treatment_id];
  const treatment = getSingleClinicalObjectFromDonor(
    mergedDonor,
    ClinicalEntitySchemaNames.TREATMENT,
    { clinicalInfo: { [TreatmentFieldsEnum.submitter_treatment_id]: treatmentId as string } },
  ) as DeepReadonly<Treatment>;
  if (!treatment) {
    validationResults.push(
      utils.buildRecordValidationResult(
        chemoRecord,
        utils.buildSubmissionError(
          chemoRecord,
          DataValidationErrors.TREATMENT_ID_NOT_FOUND,
          TreatmentFieldsEnum.submitter_treatment_id,
        ),
      ),
    );
    return undefined;
  }

  return treatment;
}
