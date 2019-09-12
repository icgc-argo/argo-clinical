import {
  SubmissionValidationError,
  FieldsEnum,
  DataValidationErrors
} from "../submission-entities";
import { DeepReadonly } from "deep-freeze";
import { DonorMap } from "../../clinical/clinical-entities";

export const validate = async (
  donorRecords: DeepReadonly<{ [key: string]: string }[]>,
  exisitingDonors: DeepReadonly<DonorMap>
): Promise<SubmissionValidationError[]> => {
  const errors: SubmissionValidationError[] = [];
  donorRecords.forEach((donorRecord, index) => {
    const donorSubmitterId = donorRecord[FieldsEnum.submitter_donor_id];
    if (!exisitingDonors[donorSubmitterId]) {
      errors.push({
        type: DataValidationErrors.ID_NOT_REGISTERED,
        fieldName: FieldsEnum.submitter_donor_id,
        info: {
          donorSubmitterId: donorSubmitterId,
          value: donorSubmitterId
        },
        index: index
      });
    }
  });
  return errors;
};
