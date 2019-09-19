import {
  SubmissionValidationError,
  DataValidationErrors,
  FieldsEnum,
  SubmittedClinicalRecord,
  SpecimenInfoFieldsEnum,
  DonorInfoFieldsEnum
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

  // Preconditions: if any one of the validation in try catch failed, can't continue
  let donorDataToValidateWith;
  try {
    utils.checkDonorRegistered(existentDonor, specimenRecord);
    utils.getRegisteredSubEntityInCollection(
      FieldsEnum.submitter_specimen_id,
      specimenRecord,
      existentDonor.specimens
    );
    donorDataToValidateWith = getDataFromRecordOrDonor(
      specimenRecord,
      newDonorRecords[FileType.DONOR],
      existentDonor
    );
  } catch (e) {
    if (e.type in DataValidationErrors) {
      return [e];
    } else {
      throw e;
    }
  }

  // cross entity sepecimen record validation
  if (
    donorDataToValidateWith.donorVitalStatus === "deceased" &&
    donorDataToValidateWith.donorSurvivalTime <
      specimenRecord[SpecimenInfoFieldsEnum.specimen_acquistion_interval]
  ) {
    errors.push(
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        SpecimenInfoFieldsEnum.specimen_acquistion_interval,
        {
          msg: `${SpecimenInfoFieldsEnum.specimen_acquistion_interval} can't be greater than ${DonorInfoFieldsEnum.survival_time}`
        }
      )
    );
  }

  return errors;
};

const getDataFromRecordOrDonor = (
  specimenRecord: DeepReadonly<SubmittedClinicalRecord>,
  donorRecord: DeepReadonly<SubmittedClinicalRecord>,
  donor: DeepReadonly<Donor>
) => {
  let donorVitalStatus: string;
  let donorSurvivalTime: number;

  if (donorRecord) {
    donorVitalStatus = String(donorRecord[DonorInfoFieldsEnum.vital_status]);
    donorSurvivalTime = Number(donorRecord[DonorInfoFieldsEnum.survival_time]);
  } else if (donor.clinicalInfo) {
    donorVitalStatus = String(donor.clinicalInfo.vitalStatus);
    donorSurvivalTime = Number(donor.clinicalInfo.survivalTime);
  }
  // nowhere to get the data to validate against, so throw error
  else {
    // might need to throw an array of errrors instead for each specimen field that can't be validated
    throw utils.buildSubmissionError(
      specimenRecord,
      DataValidationErrors.NOT_ENOUGH_INFO_TO_VALIDATE,
      SpecimenInfoFieldsEnum.specimen_acquistion_interval
    );
  }

  return { donorVitalStatus, donorSurvivalTime };
};
