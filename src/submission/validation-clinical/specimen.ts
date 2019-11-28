import {
  SubmissionValidationError,
  DataValidationErrors,
  FieldsEnum,
  SubmittedClinicalRecord,
  RecordValidationResult,
  SubmittedClinicalRecordsMap,
  ClinicalEntityType,
  DonorFieldsEnum,
  SpecimenFieldsEnum,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { isEmptyString } from '../../utils';
import { ClinicalSubmissionRecordsOperations } from './utils';

export const validate = async (
  submittedRecords: DeepReadonly<SubmittedClinicalRecordsMap>,
  existentDonor: DeepReadonly<Donor>,
): Promise<RecordValidationResult[]> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  const specimenRecords = ClinicalSubmissionRecordsOperations.getArrayRecords(
    ClinicalEntityType.SPECIMEN,
    submittedRecords,
  );
  if (specimenRecords.length === 0 || !existentDonor) {
    throw new Error("Can't call this function without donor & specimen records");
  }

  const recordValidationResults: RecordValidationResult[] = [];

  const donorDataToValidateWith = getDataFromDonorRecordOrDonor(
    existentDonor,
    submittedRecords,
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

function getSpecimenFromDonor(
  existentDonor: DeepReadonly<Donor>,
  specimenRecord: DeepReadonly<SubmittedClinicalRecord>,
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
      specimenRecord[SpecimenFieldsEnum.acquisition_interval]
  ) {
    errors.push(
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        SpecimenFieldsEnum.acquisition_interval,
        {},
      ),
    );
  }
}

const getDataFromDonorRecordOrDonor = (
  donor: DeepReadonly<Donor>,
  submittedRecords: DeepReadonly<SubmittedClinicalRecordsMap>,
  validationResults: RecordValidationResult[],
) => {
  let missingDonorFields: string[] = [];
  let donorVitalStatus: string = '';
  let donorSurvivalTime: number = NaN;
  const donorDataSource =
    ClinicalSubmissionRecordsOperations.getSingleRecord(
      ClinicalEntityType.DONOR,
      submittedRecords,
    ) || donor.clinicalInfo;

  if (!donorDataSource) {
    missingDonorFields = [DonorFieldsEnum.vital_status, DonorFieldsEnum.survival_time];
  } else {
    donorVitalStatus = donorDataSource[DonorFieldsEnum.vital_status] as string;
    donorSurvivalTime = Number(donorDataSource[DonorFieldsEnum.survival_time]) || NaN;

    if (isEmptyString(donorVitalStatus)) missingDonorFields.push(DonorFieldsEnum.vital_status);
    if (isNaN(donorSurvivalTime)) missingDonorFields.push(DonorFieldsEnum.survival_time);
  }

  if (missingDonorFields.length > 0) {
    const multipleRecordValidationResults = utils.buildMultipleRecordValidationResults(
      ClinicalSubmissionRecordsOperations.getArrayRecords(
        ClinicalEntityType.SPECIMEN,
        submittedRecords,
      ),
      {
        type: DataValidationErrors.NOT_ENOUGH_INFO_TO_VALIDATE,
        fieldName: SpecimenFieldsEnum.acquisition_interval,
        info: { missingField: missingDonorFields.map(s => ClinicalEntityType.DONOR + '.' + s) },
      },
    );
    validationResults.push(...multipleRecordValidationResults);
    return undefined;
  }

  return { donorVitalStatus, donorSurvivalTime };
};
