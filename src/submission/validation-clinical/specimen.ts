import {
  SubmissionValidationError,
  DataValidationErrors,
  FieldsEnum,
  SubmittedClinicalRecord
} from "../submission-entities";
import { DeepReadonly } from "deep-freeze";
import { Donor } from "../../clinical/clinical-entities";
import { FileType } from "../submission-api";
import * as utils from "./utils";

export const validate = async (
  newDonorRecords: DeepReadonly<{ [clinicalType: string]: SubmittedClinicalRecord }>,
  existentDonor: DeepReadonly<Donor>
): Promise<DeepReadonly<SubmissionValidationError[]>> => {
  const errors: SubmissionValidationError[] = [];
  const specimenRecord = newDonorRecords[FileType.SPECIMEN];

  // if any one of the validation in try catch failed, can't continue
  let existentSpecimen;
  try {
    utils.checkDonorExists(existentDonor, specimenRecord);
    existentSpecimen = utils.getSubEntityInCollection(
      FieldsEnum.submitter_specimen_id,
      specimenRecord,
      existentDonor.specimens
    );
  } catch (e) {
    if (e.type in DataValidationErrors) {
      return [e];
    } else {
      throw e;
    }
  }

  // other sepecimen record validation here...

  return errors;
};
