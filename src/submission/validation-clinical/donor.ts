import {
  DataValidationErrors,
  SubmittedClinicalRecord,
  SubmissionValidationError,
  RecordValidationResult,
  SpecimenFieldsEnum,
  DonorFieldsEnum,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';

export const validate = async (
  submittedDonorClinicalRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<RecordValidationResult> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***

  if (!existentDonor || !mergedDonor || !submittedDonorClinicalRecord) {
    throw new Error("Can't call this function without donor & donor record");
  }

  // ***Submission Validation checks***
  const errors: SubmissionValidationError[] = []; // all errors for record
  // cross entity donor-specimen record validation
  checkTimeConflictWithSpecimens(submittedDonorClinicalRecord, mergedDonor, errors);

  // other checks here and add to `errors`

  return utils.buildRecordValidationResult(
    submittedDonorClinicalRecord,
    errors,
    existentDonor.clinicalInfo,
  );
};

function checkTimeConflictWithSpecimens(
  donorRecord: DeepReadonly<SubmittedClinicalRecord>,
  mergedDonor: DeepReadonly<Donor>,
  errors: SubmissionValidationError[],
) {
  if (
    donorRecord[DonorFieldsEnum.vital_status].toString().toLowerCase() !== 'deceased' ||
    !donorRecord[DonorFieldsEnum.survival_time]
  ) {
    return;
  }
  const specimenIdsWithTimeConflicts: string[] = [];
  const donoSurvivalTime: number = Number(donorRecord[DonorFieldsEnum.survival_time]);

  mergedDonor.specimens.forEach(specimen => {
    let specimenAcqusitionInterval: number = 0;
    if (specimen.clinicalInfo) {
      specimenAcqusitionInterval = Number(
        specimen.clinicalInfo[SpecimenFieldsEnum.acquisition_interval],
      );
    } else {
      return; // no specimenAcqusitionInterval so move on to next specimen
    }

    if (donoSurvivalTime < specimenAcqusitionInterval) {
      specimenIdsWithTimeConflicts.push(specimen.submitterId);
    }
  });

  // check if any conflicts found
  if (specimenIdsWithTimeConflicts.length > 0) {
    errors.push(
      utils.buildSubmissionError(
        donorRecord,
        DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        DonorFieldsEnum.survival_time,
        {
          conflictingSpecimenSubmitterIds: specimenIdsWithTimeConflicts,
        },
      ),
    );
  }
}
