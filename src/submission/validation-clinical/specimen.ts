import {
  SubmissionValidationError,
  DataValidationErrors,
  FieldsEnum,
  SubmittedClinicalRecord,
  ClinicalInfoFieldsEnum,
  ValidatorResult,
  ModificationType,
  DonorRecordsObject,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Specimen } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';

export const validate = async (
  newDonorRecords: DonorRecordsObject,
  existentDonor: DeepReadonly<Donor>,
): Promise<ValidatorResult[]> => {
  const validatorResults: ValidatorResult[] = [];
  const specimenRecords = newDonorRecords.getSpecimenRecords();
  const donorRecord = newDonorRecords.getDonorRecord();

  for (const specimenRecord of specimenRecords) {
    const errors: SubmissionValidationError[] = [];

    const dataAfterPrecondition = getDataPostPreconditionCheck(
      existentDonor,
      specimenRecord,
      donorRecord,
      validatorResults,
    );

    if (!dataAfterPrecondition) {
      continue; // precondition check returned false so skip further record checks
    }

    // cross entity sepecimen record validation
    checkTimeConflictWithDonor(
      dataAfterPrecondition.donorDataToValidateWith,
      specimenRecord,
      errors,
    );

    // if no errors then check for updates
    validatorResults.push(
      errors.length > 0
        ? utils.buildValidatorResult(ModificationType.ERRORSFOUND, specimenRecord.index, errors)
        : await utils.checkForUpdates(specimenRecord, dataAfterPrecondition.specimen.clinicalInfo),
    );
  }

  return validatorResults;
};

function getDataPostPreconditionCheck(
  existentDonor: DeepReadonly<Donor>,
  specimenRecord: SubmittedClinicalRecord,
  donorRecord: SubmittedClinicalRecord | undefined,
  validatorResults: ValidatorResult[],
) {
  if (!utils.checkDonorRegistered(existentDonor, specimenRecord)) {
    validatorResults.push(
      utils.buildValidatorResult(ModificationType.ERRORSFOUND, specimenRecord.index, [
        utils.buildSubmissionError(
          specimenRecord,
          DataValidationErrors.ID_NOT_REGISTERED,
          FieldsEnum.submitter_donor_id,
        ),
      ]),
    );
    return false;
  }

  const specimen = _.find(existentDonor.specimens, [
    'submitterId',
    specimenRecord[FieldsEnum.submitter_specimen_id],
  ]);
  if (!specimen) {
    validatorResults.push(
      utils.buildValidatorResult(ModificationType.ERRORSFOUND, specimenRecord.index, [
        utils.buildSubmissionError(
          specimenRecord,
          DataValidationErrors.ID_NOT_REGISTERED,
          FieldsEnum.submitter_specimen_id,
        ),
      ]),
    );
    return false;
  }

  const donorDataToValidateWith = getDataFromRecordOrDonor(donorRecord, existentDonor);
  if (!donorDataToValidateWith) {
    validatorResults.push(
      utils.buildValidatorResult(ModificationType.ERRORSFOUND, specimenRecord.index, [
        utils.buildSubmissionError(
          specimenRecord,
          DataValidationErrors.NOT_ENOUGH_INFO_TO_VALIDATE,
          ClinicalInfoFieldsEnum.acquisition_interval,
        ),
      ]),
    );
    return false;
  }

  return { specimen, donorDataToValidateWith };
}

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
  donorRecord: DeepReadonly<SubmittedClinicalRecord | undefined>,
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
