import { SubmissionValidationError, DataValidationErrors } from "../submission-entities";

export const validate = async (records: any): Promise<SubmissionValidationError[]> => {
  // this is a dummy error
  return [
    {
      type: DataValidationErrors.INVALID_PROGRAM_ID,
      fieldName: "proramId",
      info: {},
      index: 0
    }
  ];
};
