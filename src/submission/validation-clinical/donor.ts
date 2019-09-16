import {
  SubmissionValidationError,
  FieldsEnum,
  DataValidationErrors
} from "../submission-entities";
import { DeepReadonly } from "deep-freeze";
import { Donor } from "../../clinical/clinical-entities";
import { FileType } from "../submission-api";

export const validate = async (
  newDonorRecords: DeepReadonly<{ [clinicalType: string]: any }>,
  existentDonor: DeepReadonly<Donor>
): Promise<any> => {
  const errors = [];
  const donorSubmitterId = newDonorRecords[FileType.DONOR][FieldsEnum.submitter_donor_id];
  if (!existentDonor) {
    errors.push({
      type: DataValidationErrors.ID_NOT_REGISTERED,
      fieldName: FieldsEnum.submitter_donor_id,
      info: {
        donorSubmitterId: donorSubmitterId,
        value: donorSubmitterId
      },
      index: newDonorRecords[FileType.DONOR].recordIndex
    });
  }
  return errors;
};
