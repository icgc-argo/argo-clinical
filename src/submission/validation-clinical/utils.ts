import {
  FieldsEnum,
  SubmittedClinicalRecord,
  DataValidationErrors,
  SubmissionValidationError,
  ClinicalInfoFieldsEnum,
  ModificationType,
  SubmissionValidationUpdate,
  ValidatorResult,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';

export const checkDonorRegistered = (
  aDonor: DeepReadonly<Donor>,
  record: DeepReadonly<SubmittedClinicalRecord>,
) => {
  return aDonor && aDonor.submitterId === record[FieldsEnum.submitter_donor_id];
};

export const buildSubmissionError = (
  newRecord: SubmittedClinicalRecord,
  type: DataValidationErrors,
  fieldName: FieldsEnum | ClinicalInfoFieldsEnum,
  info: object = {},
): SubmissionValidationError => {
  // typescript refused to take this directly
  const index: number = newRecord.index;
  return {
    type,
    fieldName,
    index,
    info: {
      ...info,
      donorSubmitterId: newRecord[FieldsEnum.submitter_donor_id],
      value: newRecord[fieldName],
    },
  };
};

export const buildSubmissionUpdate = (
  newRecord: SubmittedClinicalRecord,
  oldValue: string,
  fieldName: FieldsEnum | ClinicalInfoFieldsEnum | string,
) => {
  // typescript refused to take this directly
  const index: number = newRecord.index;
  return {
    fieldName,
    index,
    info: {
      donorSubmitterId: newRecord[FieldsEnum.submitter_donor_id],
      newValue: newRecord[fieldName],
      oldValue,
    },
  };
};

export const buildValidatorResult = (
  type: ModificationType,
  index: number,
  resultArray?: SubmissionValidationError[] | SubmissionValidationUpdate[],
): ValidatorResult => {
  return { type, index, resultArray };
};

export const getUpdatedFields = (clinicalInfo: any, record: SubmittedClinicalRecord) => {
  const updateFields: any[] = [];
  if (clinicalInfo) {
    for (const fieldName in clinicalInfo) {
      // this is assuming that the field name record and clinicalInfo both have snake casing
      if (clinicalInfo[fieldName] !== record[fieldName]) {
        updateFields.push(buildSubmissionUpdate(record, clinicalInfo[fieldName], fieldName));
      }
    }
  }
  return updateFields;
};
