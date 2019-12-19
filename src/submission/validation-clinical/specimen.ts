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
): Promise<SubmissionValidationError[]> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***

  if (!specimenRecord || !existentDonor || !mergedDonor) {
    throw new Error("Can't call this function without donor & donor record");
  }

  const errors: SubmissionValidationError[] = []; // all errors for record

  const donorDataToValidateWith = getDataFromDonorRecordOrDonor(
    specimenRecord,
    mergedDonor,
    errors,
  );
  if (!donorDataToValidateWith) {
    return errors;
  }

  const specimen = getSpecimenFromDonor(existentDonor, specimenRecord, errors);
  if (!specimen) {
    return errors;
  }

  checkTimeConflictWithDonor(donorDataToValidateWith, specimenRecord, errors);

  // other checks here and add to `errors`

  return errors;
};

function getSpecimenFromDonor(
  existentDonor: DeepReadonly<Donor>,
  specimenRecord: DeepReadonly<SubmittedClinicalRecord>,
  errors: SubmissionValidationError[],
) {
  const specimen = getSingleClinicalObjectFromDonor(
    existentDonor,
    ClinicalEntitySchemaNames.SPECIMEN,
    {
      submitterId: specimenRecord[ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.SPECIMEN]],
    },
  ) as DeepReadonly<Specimen>;

  if (!specimen) {
    errors.push(
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.ID_NOT_REGISTERED,
        SpecimenFieldsEnum.submitter_specimen_id,
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
      specimenRecord[SpecimenFieldsEnum.specimen_acquisition_interval]
  ) {
    errors.push(
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        SpecimenFieldsEnum.specimen_acquisition_interval,
        {},
      ),
    );
  }
}

const getDataFromDonorRecordOrDonor = (
  specimenRecord: DeepReadonly<SubmittedClinicalRecord>,
  donor: DeepReadonly<Donor>,
  errors: SubmissionValidationError[],
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
    errors.push(
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.NOT_ENOUGH_INFO_TO_VALIDATE,
        SpecimenFieldsEnum.specimen_acquisition_interval,
        {
          missingField: missingDonorFields.map(s => ClinicalEntitySchemaNames.DONOR + '.' + s),
        },
      ),
    );
    return undefined;
  }

  return { donorVitalStatus, donorSurvivalTime };
};
