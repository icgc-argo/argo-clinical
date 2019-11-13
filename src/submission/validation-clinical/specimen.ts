import {
  SubmissionValidationError,
  DataValidationErrors,
  FieldsEnum,
  SubmittedClinicalRecord,
  ClinicalInfoFieldsEnum,
  RecordValidationResult,
  DonorRecordsOrganizer,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Specimen } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { isEmptyString } from '../../utils';
import { RecordsOrganizerOperations as organizerOperations } from './utils';

export const validate = async (
  recordOrganizer: DeepReadonly<DonorRecordsOrganizer>,
  existentDonor: DeepReadonly<Donor>,
): Promise<RecordValidationResult[]> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  const specimenRecords = organizerOperations.getSpecimenRecords(recordOrganizer);
  if (specimenRecords.length === 0 || !existentDonor) {
    throw new Error("Can't call this function without donor & specimen records");
  }

  const recordValidationResults: RecordValidationResult[] = [];

  const donorDataToValidateWith = getDataFromDonorRecordOrDonor(
    existentDonor,
    recordOrganizer,
    recordValidationResults,
  );
  if (!donorDataToValidateWith) {
    return recordValidationResults;
  }

  for (const specimenRecord of specimenRecords) {
    // ***Precondition for each specimenRecord checks***
    const specimen = getSpecimenFromDonor(existentDonor, specimenRecord, recordValidationResults);
    if (!specimen) {
      continue;
    }

    // ***Submission Validation checks***
    const errors: SubmissionValidationError[] = []; // all errors for record
    // cross entity donor-sepecimen record validation
    checkTimeConflictWithDonor(donorDataToValidateWith, specimenRecord, errors);
    // other checks here and add to `errors`

    recordValidationResults.push(
      utils.buildRecordValidationResult(specimenRecord, errors, specimen.clinicalInfo),
    );
  }

  return recordValidationResults;
};

const getDataFromDonorRecordOrDonor = (
  donor: DeepReadonly<Donor>,
  newDonorRecords: DeepReadonly<DonorRecordsOrganizer>,
  validationResults: RecordValidationResult[],
) => {
  let missingField: ClinicalInfoFieldsEnum[] = [];
  let donorVitalStatus: string = '';
  let donorSurvivalTime: number = NaN;
  const donorDataSource = organizerOperations.getDonorRecord(newDonorRecords) || donor.clinicalInfo;

  if (!donorDataSource) {
    missingField = [ClinicalInfoFieldsEnum.vital_status, ClinicalInfoFieldsEnum.survival_time];
  } else {
    donorVitalStatus = donorDataSource[ClinicalInfoFieldsEnum.vital_status] as string;
    donorSurvivalTime = Number(donorDataSource[ClinicalInfoFieldsEnum.survival_time]) || NaN;

    if (isEmptyString(donorVitalStatus)) missingField.push(ClinicalInfoFieldsEnum.vital_status);
    if (isNaN(donorSurvivalTime)) missingField.push(ClinicalInfoFieldsEnum.survival_time);
  }

  if (missingField.length > 0) {
    const specimenRecords = organizerOperations.getSpecimenRecords(newDonorRecords);
    specimenRecords.forEach(specimenRecord =>
      validationResults.push(
        utils.buildRecordValidationResult(
          specimenRecord,
          utils.buildSubmissionError(
            specimenRecord,
            DataValidationErrors.NOT_ENOUGH_INFO_TO_VALIDATE,
            ClinicalInfoFieldsEnum.acquisition_interval,
            { missingField },
          ),
        ),
      ),
    );
    return undefined;
  }

  return { donorVitalStatus, donorSurvivalTime };
};

function getSpecimenFromDonor(
  existentDonor: DeepReadonly<Donor>,
  specimenRecord: SubmittedClinicalRecord,
  validationResults: RecordValidationResult[],
) {
  const specimen = _.find(existentDonor.specimens, [
    'submitterId',
    specimenRecord[FieldsEnum.submitter_specimen_id],
  ]);
  if (!specimen) {
    validationResults.push(
      utils.buildRecordValidationResult(
        specimenRecord,
        utils.buildSubmissionError(
          specimenRecord,
          DataValidationErrors.ID_NOT_REGISTERED,
          FieldsEnum.submitter_specimen_id,
        ),
      ),
    );
    return undefined;
  }

  return specimen;
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
