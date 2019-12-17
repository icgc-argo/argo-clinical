import {
  SubmissionValidationError,
  DataValidationErrors,
  SubmittedClinicalRecord,
  RecordValidationResult,
  ClinicalEntitySchemaNames,
  DonorFieldsEnum,
  SpecimenFieldsEnum,
  ClinicalUniqueIndentifier,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Specimen } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { isEmptyString } from '../../utils';
import { getSingleClinicalObjectFromDonor } from '../submission-to-clinical/submission-to-clinical';

export const validate = async (
  specimenRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<RecordValidationResult[]> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***

  if (!specimenRecord || !existentDonor || !mergedDonor) {
    throw new Error("Can't call this function without donor & donor record");
  }

  const recordValidationResults: RecordValidationResult[] = [];

  const donorDataToValidateWith = getDataFromDonorRecordOrDonor(
    specimenRecord,
    mergedDonor,
    recordValidationResults,
  );
  if (!donorDataToValidateWith) {
    return recordValidationResults;
  }

  const specimen = getSpecimenFromDonor(existentDonor, specimenRecord, recordValidationResults);
  if (!specimen) {
    return recordValidationResults;
  }

  // ***Submission Validation checks***
  const errors: SubmissionValidationError[] = []; // all errors for record
  // cross entity donor-sepecimen record validation
  checkTimeConflictWithDonor(donorDataToValidateWith, specimenRecord, errors);

  // other checks here and add to `errors`

  recordValidationResults.push(
    utils.buildRecordValidationResult(specimenRecord, errors, specimen.clinicalInfo),
  );

  return recordValidationResults;
};

function getSpecimenFromDonor(
  existentDonor: DeepReadonly<Donor>,
  specimenRecord: DeepReadonly<SubmittedClinicalRecord>,
  validationResults: RecordValidationResult[],
) {
  const specimen = getSingleClinicalObjectFromDonor(
    existentDonor,
    ClinicalEntitySchemaNames.SPECIMEN,
    {
      submitterId: specimenRecord[ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.SPECIMEN]],
    },
  ) as DeepReadonly<Specimen>;

  if (!specimen) {
    validationResults.push(
      utils.buildRecordValidationResult(
        specimenRecord,
        utils.buildSubmissionError(
          specimenRecord,
          DataValidationErrors.ID_NOT_REGISTERED,
          SpecimenFieldsEnum.submitter_specimen_id,
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
  specimenRecord: DeepReadonly<SubmittedClinicalRecord>,
  donor: DeepReadonly<Donor>,
  validationResults: RecordValidationResult[],
) => {
  let missingDonorFields: string[] = [];
  let donorVitalStatus: string = '';
  let donorSurvivalTime: number = NaN;
  const donorDataSource = donor.clinicalInfo;

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
      [specimenRecord],
      {
        type: DataValidationErrors.NOT_ENOUGH_INFO_TO_VALIDATE,
        fieldName: SpecimenFieldsEnum.acquisition_interval,
        info: {
          missingField: missingDonorFields.map(s => ClinicalEntitySchemaNames.DONOR + '.' + s),
        },
      },
    );
    validationResults.push(...multipleRecordValidationResults);
    return undefined;
  }

  return { donorVitalStatus, donorSurvivalTime };
};
