import {
  SubmissionValidationError,
  RecordValidationResult,
  SubmittedClinicalRecordsMap,
  ClinicalEntitySchemaNames,
  TreatmentFieldsEnum,
  SubmittedClinicalRecord,
  TreatmentDataValidationErrors,
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

    const treatmentClinicalInfo = getTreatmentClinicalInfo(existentDonor, treatmentRecord);

    recordValidationResults.push(
      utils.buildRecordValidationResult(treatmentRecord, errors, treatmentClinicalInfo),
    );
  }

  return recordValidationResults;
};

function getTreatmentClinicalInfo(
  existentDonor: DeepReadonly<Donor>,
  treatmentRecord: SubmittedClinicalRecord,
) {
  const submitter_treatment_id = treatmentRecord[TreatmentFieldsEnum.submitter_treatment_id];
  return (existentDonor.treatments || []).find(tr => tr.submitterId === submitter_treatment_id);
}

function checkChemoFileNeeded(
  treatmentRecord: SubmittedClinicalRecord,
  mergedDonor: DeepReadonly<Donor>,
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
  const treatment = findTreatment(mergedDonor, treatmentId as string);

  if (
    treatment.therapies.length === 0 ||
    !treatment.therapies.some(th => th.therapyType === ClinicalEntitySchemaNames.CHEMOTHERAPY)
  ) {
    errors.push(
      utils.buildSubmissionError(
        treatmentRecord,
        TreatmentDataValidationErrors.MISSING_THERAPY_DATA,
        TreatmentFieldsEnum.treatment_type,
        {
          therapyType: ClinicalEntitySchemaNames.CHEMOTHERAPY,
        },
      ),
    );
  }
}

function findTreatment(donor: DeepReadonly<Donor>, treatmentId: string): DeepReadonly<Treatment> {
  let treatment;
  if (donor.treatments) {
    treatment = donor.treatments.find(tr => tr.submitterId === treatmentId);
  }
  if (!treatment) {
    throw new Errors.StateConflict(`Treatment missing from donor.`);
  }
  return treatment;
}
