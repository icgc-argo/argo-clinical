import {
  SubmissionValidationError,
  DataValidationErrors,
  FieldsEnum,
  SubmittedClinicalRecord,
  ClinicalInfoFieldsEnum
} from "../submission-entities";
import { DeepReadonly } from "deep-freeze";
import { Donor, Specimen } from "../../clinical/clinical-entities";
import { FileType } from "../submission-api";
import * as utils from "./utils";

export const validate = async (
  newDonorRecords: DeepReadonly<{ [clinicalType: string]: SubmittedClinicalRecord }>,
  existentDonor: DeepReadonly<Donor>
): Promise<any> => {
  const errors: SubmissionValidationError[] = [];
  const specimenRecord = newDonorRecords[FileType.SPECIMEN];

  // Preconditions: if any one of the validation in try catch failed, can't continue
  if (!utils.checkDonorRegistered(existentDonor, specimenRecord)) {
    return [
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.ID_NOT_REGISTERED,
        FieldsEnum.submitter_donor_id
      )
    ];
  }

  const specimen = utils.getRegisteredSubEntityInCollection(
    FieldsEnum.submitter_specimen_id,
    specimenRecord,
    existentDonor.specimens
  ) as Specimen;
  if (!specimen) {
    return [
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.ID_NOT_REGISTERED,
        FieldsEnum.submitter_specimen_id
      )
    ];
  }

  const donorDataToValidateWith = getDataFromRecordOrDonor(
    newDonorRecords[FileType.DONOR],
    existentDonor
  );
  if (!donorDataToValidateWith) {
    return [
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.NOT_ENOUGH_INFO_TO_VALIDATE,
        ClinicalInfoFieldsEnum.specimen_acquistion_interval
      )
    ];
  }

  // cross entity sepecimen record validation
  checkTimeConflictWithDonor(donorDataToValidateWith, specimenRecord, errors);

  if (errors.length > 0) {
    return errors;
  } else {
    return calculateStats(specimenRecord, specimen);
  }
};

// cases
// 1 not changing specimenType or tnd and new clinicalInfo <=> new
// 2 changing specimenType or tnd or changing clinicalInfo <=> update
// 3 not new or update <=> noUpdate
function calculateStats(record: SubmittedClinicalRecord, specimen: Specimen) {
  const clinicalInfo = specimen.clinicalInfo;

  // no updates to specimenType or tnd but there is no existent clinicalInfo => new
  if (
    specimen.specimenType === record[FieldsEnum.specimen_type] &&
    specimen.tumourNormalDesignation === record[FieldsEnum.tumour_normal_designation] &&
    !clinicalInfo
  ) {
    return { new: record.index };
  }

  // check changing fields
  const updateFields: any[] = utils.getUpdatedFields(clinicalInfo, record);

  if (specimen.specimenType !== record[FieldsEnum.specimen_type]) {
    updateFields.push({
      fieldName: FieldsEnum.specimen_type,
      index: record.index,
      info: {
        oldValue: specimen.specimenType,
        newValue: record[FieldsEnum.specimen_type]
      }
    });
  }

  if (specimen.tumourNormalDesignation !== record[FieldsEnum.tumour_normal_designation]) {
    updateFields.push({
      fieldName: FieldsEnum.tumour_normal_designation,
      index: record.index,
      info: {
        oldValue: specimen.tumourNormalDesignation,
        newValue: record[FieldsEnum.tumour_normal_designation]
      }
    });
  }

  // if no updates and not new return noUpdate
  return updateFields.length === 0 ? { noUpdate: record.index } : { updateFields };
}

function checkTimeConflictWithDonor(
  donorDataToValidateWith: { [k: string]: any },
  specimenRecord: SubmittedClinicalRecord,
  errors: SubmissionValidationError[]
) {
  if (
    donorDataToValidateWith.donorVitalStatus === "deceased" &&
    donorDataToValidateWith.donorSurvivalTime <
      specimenRecord[ClinicalInfoFieldsEnum.specimen_acquistion_interval]
  ) {
    errors.push(
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        ClinicalInfoFieldsEnum.specimen_acquistion_interval,
        {
          msg: `${ClinicalInfoFieldsEnum.specimen_acquistion_interval} can't be greater than ${ClinicalInfoFieldsEnum.survival_time}`
        }
      )
    );
  }
}

const getDataFromRecordOrDonor = (
  donorRecord: DeepReadonly<SubmittedClinicalRecord>,
  donor: DeepReadonly<Donor>
) => {
  let donorVitalStatus: string;
  let donorSurvivalTime: number;

  if (donorRecord) {
    donorVitalStatus = String(donorRecord[ClinicalInfoFieldsEnum.vital_status]);
    donorSurvivalTime = Number(donorRecord[ClinicalInfoFieldsEnum.survival_time]);
  } else if (donor.clinicalInfo) {
    donorVitalStatus = String(donor.clinicalInfo.vitalStatus);
    donorSurvivalTime = Number(donor.clinicalInfo.survivalTime);
  } else {
    return undefined;
  }

  return { donorVitalStatus, donorSurvivalTime };
};
