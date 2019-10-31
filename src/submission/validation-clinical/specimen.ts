import {
  SubmissionValidationError,
  DataValidationErrors,
  FieldsEnum,
  SubmittedClinicalRecord,
  ClinicalInfoFieldsEnum,
  ValidatorResult,
  ModificationType,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Specimen } from '../../clinical/clinical-entities';
import { FileType } from '../submission-api';
import * as utils from './utils';
import _ from 'lodash';

export const validate = async (
  newDonorRecords: DeepReadonly<{ [clinicalType: string]: SubmittedClinicalRecord }>,
  existentDonor: DeepReadonly<Donor>,
): Promise<ValidatorResult> => {
  const errors: SubmissionValidationError[] = [];
  const specimenRecord = newDonorRecords[FileType.SPECIMEN];

  // Preconditions: if any one of the validation in try catch failed, can't continue
  if (!utils.checkDonorRegistered(existentDonor, specimenRecord)) {
    return utils.buildValidatorResult(ModificationType.ERRORSFOUND, specimenRecord.index, [
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.ID_NOT_REGISTERED,
        FieldsEnum.submitter_donor_id,
      ),
    ]);
  }

  const specimen = _.find(existentDonor.specimens, [
    'submitterId',
    specimenRecord[FieldsEnum.submitter_specimen_id],
  ]);
  if (!specimen) {
    return utils.buildValidatorResult(ModificationType.ERRORSFOUND, specimenRecord.index, [
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.ID_NOT_REGISTERED,
        FieldsEnum.submitter_specimen_id,
      ),
    ]);
  }

  const donorDataToValidateWith = getDataFromRecordOrDonor(
    newDonorRecords[FileType.DONOR],
    existentDonor,
  );
  if (!donorDataToValidateWith) {
    return utils.buildValidatorResult(ModificationType.ERRORSFOUND, specimenRecord.index, [
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.NOT_ENOUGH_INFO_TO_VALIDATE,
        ClinicalInfoFieldsEnum.acquisition_interval,
      ),
    ]);
  }

  // cross entity sepecimen record validation
  checkTimeConflictWithDonor(donorDataToValidateWith, specimenRecord, errors);

  return errors.length > 0
    ? utils.buildValidatorResult(ModificationType.ERRORSFOUND, specimenRecord.index, errors)
    : await utils.checkForUpdates(specimenRecord, specimen.clinicalInfo);
};

function checkTimeConflictWithDonor(
  donorDataToValidateWith: { [k: string]: any },
  specimenRecord: SubmittedClinicalRecord,
  errors: SubmissionValidationError[],
) {
  if (
    donorDataToValidateWith.donorVitalStatus.toString().toLowerCase() === 'deceased' &&
    donorDataToValidateWith.donorSurvivalTime <
      specimenRecord[ClinicalInfoFieldsEnum.acquisition_interval]
  ) {
    errors.push(
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        ClinicalInfoFieldsEnum.acquisition_interval,
        {},
      ),
    );
  }
}

const getDataFromRecordOrDonor = (
  donorRecord: DeepReadonly<SubmittedClinicalRecord>,
  donor: DeepReadonly<Donor>,
) => {
  let donorVitalStatus: string;
  let donorSurvivalTime: number;

  if (donorRecord) {
    donorVitalStatus = String(donorRecord[ClinicalInfoFieldsEnum.vital_status]);
    donorSurvivalTime = Number(donorRecord[ClinicalInfoFieldsEnum.survival_time]);
  } else if (donor.clinicalInfo) {
    donorVitalStatus = String(donor.clinicalInfo[ClinicalInfoFieldsEnum.vital_status]);
    donorSurvivalTime = Number(donor.clinicalInfo[ClinicalInfoFieldsEnum.survival_time]);
  } else {
    return undefined;
  }

  return { donorVitalStatus, donorSurvivalTime };
};
