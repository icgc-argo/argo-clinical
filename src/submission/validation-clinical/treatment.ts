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
import { getClinicalEntityFromDonorBySchemaNameAndConstraint } from '../submission-to-clinical/submission-to-clinical';

export const validate = async (
  submittedRecords: DeepReadonly<SubmittedClinicalRecordsMap>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<RecordValidationResult[]> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  const submittedTreatmentRecords = ClinicalSubmissionRecordsOperations.getArrayRecords(
    ClinicalEntitySchemaNames.TREATMENT,
    submittedRecords,
  );
  if (!submittedTreatmentRecords || !existentDonor) {
    throw new Error("Can't call this function without a registerd donor & treatment record");
  }

  const recordValidationResults: RecordValidationResult[] = [];
  for (const treatmentRecord of submittedTreatmentRecords) {
    const errors: SubmissionValidationError[] = [];

    checkChemoFileNeeded(treatmentRecord, mergedDonor, errors);

    // leaving this for now, stats will me moved out of validate so this won't be needed
    const treatmentClinicalInfo = getTreatmentClinicalInfo(existentDonor, treatmentRecord);
    recordValidationResults.push(
      utils.buildRecordValidationResult(treatmentRecord, errors, treatmentClinicalInfo),
    );
  }

  return recordValidationResults;
};

// same here
function getTreatmentClinicalInfo(
  existentDonor: DeepReadonly<Donor>,
  treatmentRecord: SubmittedClinicalRecord,
) {
  const idFieldName = TreatmentFieldsEnum.submitter_treatment_id;
  const treatment_id = treatmentRecord[idFieldName];
  return (existentDonor.treatments || []).find(tr => tr.clinicalInfo[idFieldName] === treatment_id);
}

function checkChemoFileNeeded(
  treatmentRecord: SubmittedClinicalRecord,
  mergedDonor: Donor,
  errors: SubmissionValidationError[],
) {
  const treatmentType = treatmentRecord[TreatmentFieldsEnum.treatment_type];
  if (
    treatmentType.toString().toLowerCase() !== 'combined chemo+immunotherapy' &&
    treatmentType.toString().toLowerCase() !== 'combined chemo+radiation therapy' &&
    treatmentType.toString().toLowerCase() !== 'combined chemo-radiotherapy and surgery'
  ) {
    return;
  }

  const treatmentId = treatmentRecord[TreatmentFieldsEnum.submitter_treatment_id];
  const treatment = getClinicalEntityFromDonorBySchemaNameAndConstraint(
    mergedDonor,
    ClinicalEntitySchemaNames.TREATMENT,
    { [TreatmentFieldsEnum.submitter_treatment_id]: treatmentId as string },
  ) as Treatment;
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
