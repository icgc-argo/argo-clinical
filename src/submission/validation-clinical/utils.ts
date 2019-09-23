import {
  FieldsEnum,
  SubmittedClinicalRecord,
  DataValidationErrors,
  SubmissionValidationError,
  ClinicalInfoFieldsEnum,
  RecordToDonorFieldsMap,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { DonorSubEntity, Donor } from '../../clinical/clinical-entities';

export enum ValidationResult {
  ERRORSFOUND,
  NEW,
  UPDATED,
  NOUPDATE,
}

export const checkDonorRegistered = (
  aDonor: DeepReadonly<Donor>,
  record: DeepReadonly<SubmittedClinicalRecord>,
) => {
  return aDonor && aDonor.submitterId === record[FieldsEnum.submitter_donor_id];
};

export const getRegisteredSubEntityInCollection = (
  submitterIdType: FieldsEnum.submitter_specimen_id | FieldsEnum.submitter_sample_id, // add other Ids as needed
  record: DeepReadonly<SubmittedClinicalRecord>,
  clinicalCollection: DeepReadonly<Array<DonorSubEntity>>,
) => {
  return clinicalCollection.find(entity => entity.submitterId === record[submitterIdType]);
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

export const getUpdatedFields = (clinicalInfo: any, record: SubmittedClinicalRecord) => {
  const updateFields: any[] = [];
  if (clinicalInfo) {
    for (const field in clinicalInfo) {
      if (clinicalInfo[field] !== record[RecordToDonorFieldsMap[field]]) {
        updateFields.push({
          fieldName: RecordToDonorFieldsMap[field],
          index: record.index,
          info: {
            oldValue: clinicalInfo[field],
            newValue: record[RecordToDonorFieldsMap[field]],
          },
        });
      }
    }
  }
  return updateFields;
};
