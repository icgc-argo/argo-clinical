import {
  FieldsEnum,
  SubmittedClinicalRecord,
  DataValidationErrors,
  SubmissionValidationError
} from "../submission-entities";
import { DeepReadonly } from "deep-freeze";
import { DonorSubEntity, Donor } from "../../clinical/clinical-entities";

export const checkDonorExists = (
  aDonor: DeepReadonly<Donor>,
  record: DeepReadonly<SubmittedClinicalRecord>
) => {
  if (!aDonor) {
    throw buildSubmissionError(
      record,
      DataValidationErrors.ID_NOT_REGISTERED,
      FieldsEnum.submitter_donor_id,
      record.index
    );
  }
};

export const getSubEntityInCollection = (
  submitterIdType: FieldsEnum.submitter_specimen_id | FieldsEnum.submitter_sample_id, // add other Ids as needed
  record: DeepReadonly<SubmittedClinicalRecord>,
  clinicalCollection: DeepReadonly<Array<DonorSubEntity>>
) => {
  const subEntity = clinicalCollection.find(
    entity => entity.submitterId === record[submitterIdType]
  );
  if (!subEntity) {
    throw buildSubmissionError(
      record,
      DataValidationErrors.ID_NOT_REGISTERED,
      submitterIdType,
      record.index
    );
  }
  return subEntity;
};

export const buildSubmissionError = (
  newRecord: SubmittedClinicalRecord,
  type: DataValidationErrors,
  fieldName: FieldsEnum,
  index: number,
  info: object = {}
): SubmissionValidationError => {
  return {
    type,
    fieldName,
    index,
    info: {
      ...info,
      donorSubmitterId: newRecord.submitter_donor_id,
      value: newRecord[fieldName]
    }
  };
};
