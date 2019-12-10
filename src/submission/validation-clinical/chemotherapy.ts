import {
  SubmissionValidationError,
  RecordValidationResult,
  SubmittedClinicalRecordsMap,
  ClinicalEntityType,
  TreatmentFieldsEnum,
  SubmittedClinicalRecord,
  TreatmentDataValidationErrors,
  DataValidationErrors,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Treatment } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { ClinicalSubmissionRecordsOperations } from './utils';
import { Errors } from '../../../src/utils';

export const validate = async (
  submittedRecords: DeepReadonly<SubmittedClinicalRecordsMap>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: DeepReadonly<Donor>,
): Promise<RecordValidationResult[]> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  const submittedChemotherapyRecords = ClinicalSubmissionRecordsOperations.getArrayRecords(
    ClinicalEntityType.CHEMOTHERAPY,
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
  if (
    treatmentType.toString().toLowerCase() !== 'combined chemo+immunotherapy' &&
    treatmentType.toString().toLowerCase() !== 'combined chemo+radiation therapy' &&
    treatmentType.toString().toLowerCase() !== 'combined chemo-radiotherapy and surgery'
  ) {
    errors.push(
      utils.buildSubmissionError(
        chemoRecord,
        TreatmentDataValidationErrors.CONFLICTING_THERAPY_TREATMENT_DATA,
        TreatmentFieldsEnum.treatment_type,
        {},
      ),
    );
  }
}

function getTreatment(
  chemoRecord: SubmittedClinicalRecord,
  mergedDonor: DeepReadonly<Donor>,
  validationResults: RecordValidationResult[],
) {
  const treatmentId = chemoRecord[TreatmentFieldsEnum.submitter_treatment_id];
  const treatment = findTreatment(mergedDonor, treatmentId as string);
  if (!treatment) {
    validationResults.push(
      utils.buildRecordValidationResult(
        chemoRecord,
        utils.buildSubmissionError(
          chemoRecord,
          DataValidationErrors.ID_NOT_REGISTERED,
          TreatmentFieldsEnum.submitter_treatment_id,
        ),
      ),
    );
    return undefined;
  }

  return treatment;
}
function findTreatment(donor: DeepReadonly<Donor>, treatmentId: string) {
  if (donor.treatments) {
    return donor.treatments.find(tr => tr.submitterId === treatmentId);
  }
  return undefined;
}
