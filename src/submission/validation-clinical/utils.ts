import {
  FieldsEnum,
  SubmittedClinicalRecord,
  DataValidationErrors,
  SubmissionValidationError,
  SpecimenInfoFieldsEnum,
  DonorInfoFieldsEnum
} from "../submission-entities";
import { DeepReadonly } from "deep-freeze";
import { DonorSubEntity, Donor } from "../../clinical/clinical-entities";

export const checkDonorRegistered = (
  aDonor: DeepReadonly<Donor>,
  record: DeepReadonly<SubmittedClinicalRecord>
) => {
  if (!aDonor) {
    throw buildSubmissionError(
      record,
      DataValidationErrors.ID_NOT_REGISTERED,
      FieldsEnum.submitter_donor_id
    );
  }
};

export const getRegisteredSubEntityInCollection = (
  submitterIdType: FieldsEnum.submitter_specimen_id | FieldsEnum.submitter_sample_id, // add other Ids as needed
  record: DeepReadonly<SubmittedClinicalRecord>,
  clinicalCollection: DeepReadonly<Array<DonorSubEntity>>
) => {
  const subEntity = clinicalCollection.find(
    entity => entity.submitterId === record[submitterIdType]
  );
  if (!subEntity) {
    throw buildSubmissionError(record, DataValidationErrors.ID_NOT_REGISTERED, submitterIdType);
  }
  return subEntity;
};

export const buildSubmissionError = (
  newRecord: SubmittedClinicalRecord,
  type: DataValidationErrors,
  fieldName: FieldsEnum | SpecimenInfoFieldsEnum | DonorInfoFieldsEnum,
  info: object = {}
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
      value: newRecord[fieldName]
    }
  };
};
