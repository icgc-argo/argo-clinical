import {
  FieldsEnum,
  DataValidationErrors,
  SubmittedClinicalRecord,
  SubmissionValidationError,
  DonorInfoFieldsEnum,
  SpecimenInfoFieldsEnum
} from "../submission-entities";
import { DeepReadonly } from "deep-freeze";
import { Donor } from "../../clinical/clinical-entities";
import { FileType } from "../submission-api";
import * as utils from "./utils";

export const validate = async (
  newRecords: DeepReadonly<{ [clinicalType: string]: SubmittedClinicalRecord }>,
  existentDonor: DeepReadonly<Donor>
): Promise<DeepReadonly<SubmissionValidationError[]>> => {
  const errors: SubmissionValidationError[] = [];
  const donorRecord = newRecords[FileType.DONOR];

  // Preconditions: if any one of the validation in try catch failed, can't continue
  try {
    utils.checkDonorRegistered(existentDonor, donorRecord);
  } catch (e) {
    if (e.type in DataValidationErrors) {
      return [e];
    } else {
      throw e;
    }
  }

  // cross entity donor record validation
  checkTimeConflictWithSpecimen(existentDonor, donorRecord, newRecords[FileType.SPECIMEN], errors);

  return errors;
};

function checkTimeConflictWithSpecimen(
  donor: DeepReadonly<Donor>,
  donorRecord: DeepReadonly<SubmittedClinicalRecord>,
  specimenRecord: DeepReadonly<SubmittedClinicalRecord>,
  errors: SubmissionValidationError[]
) {
  if (donorRecord[DonorInfoFieldsEnum.vital_status] !== "deceased") {
    return;
  }
  const specimenIdsWithTimeConflicts: string[] = [];
  const donoSurvivalTime: number = Number(donorRecord[DonorInfoFieldsEnum.survival_time]);

  donor.specimens.forEach(specimen => {
    let specimenAcqusitionInterval: number = 0;
    // specimenAcqusitionInterval comes from either registered specimen in new record or specimen.clincalInfo
    if (
      specimenRecord &&
      specimenRecord[FieldsEnum.submitter_specimen_id] === specimen.submitterId
    ) {
      specimenAcqusitionInterval = Number(
        specimenRecord[SpecimenInfoFieldsEnum.specimen_acquistion_interval]
      );
    } else if (specimen.clinicalInfo) {
      specimenAcqusitionInterval = Number(specimen.clinicalInfo.specimenAcqusitionInterval);
    } else {
      return; // no specimenAcqusitionInterval so move on to next specimen
    }

    if (donoSurvivalTime < specimenAcqusitionInterval) {
      specimenIdsWithTimeConflicts.push(specimenRecord[FieldsEnum.submitter_specimen_id] as string);
    }
  });

  // check if any conflicts found
  if (specimenIdsWithTimeConflicts.length > 0) {
    errors.push(
      utils.buildSubmissionError(
        donorRecord,
        DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        DonorInfoFieldsEnum.survival_time,
        {
          msg: `${DonorInfoFieldsEnum.survival_time} can't be less than a specimen's acquistion time`,
          conflictingSpecimenSubmitterIds: specimenIdsWithTimeConflicts
        }
      )
    );
  }
}
