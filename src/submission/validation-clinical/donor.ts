import {
  DataValidationErrors,
  SubmittedClinicalRecord,
  SubmissionValidationError,
  ClinicalInfoFieldsEnum,
  RecordValidationResult,
  DonorRecordsOrganizer,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { DonorRecordsOrganizerOperations as organizerOperations } from './utils';

export const validate = async (
  newRecordsOrganizer: DeepReadonly<DonorRecordsOrganizer>,
  existentDonor: DeepReadonly<Donor>,
): Promise<RecordValidationResult> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  const donorRecord = organizerOperations.getDonorRecord(newRecordsOrganizer);
  if (!existentDonor || !donorRecord) {
    throw new Error("Can't call this function without donor & donor record");
  }

  // ***Submission Validation checks***
  const errors: SubmissionValidationError[] = []; // all errors for record

  // cross entity donor-specimen record validation
  checkTimeConflictWithSpecimens(existentDonor, donorRecord, newRecordsOrganizer, errors);

  // other checks here and add to `errors`

  return utils.buildRecordValidationResult(donorRecord, errors, existentDonor.clinicalInfo);
};

function checkTimeConflictWithSpecimens(
  donor: DeepReadonly<Donor>,
  donorRecord: DeepReadonly<SubmittedClinicalRecord>,
  recordsOrganizer: DeepReadonly<DonorRecordsOrganizer>,
  errors: SubmissionValidationError[],
) {
  if (
    donorRecord[ClinicalInfoFieldsEnum.vital_status].toString().toLowerCase() !== 'deceased' ||
    !donorRecord[ClinicalInfoFieldsEnum.survival_time]
  ) {
    return;
  }
  const specimenIdsWithTimeConflicts: string[] = [];
  const donoSurvivalTime: number = Number(donorRecord[ClinicalInfoFieldsEnum.survival_time]);

  donor.specimens.forEach(specimen => {
    let specimenAcqusitionInterval: number = 0;
    // specimenAcqusitionInterval comes from either registered specimen in new record or specimen.clincalInfo
    const specimenRecord = organizerOperations.getSpecimenRecordBySubmitterId(
      specimen.submitterId,
      recordsOrganizer,
    );
    if (specimenRecord) {
      specimenAcqusitionInterval = Number(
        specimenRecord[ClinicalInfoFieldsEnum.acquisition_interval],
      );
    } else if (specimen.clinicalInfo) {
      specimenAcqusitionInterval = Number(
        specimen.clinicalInfo[ClinicalInfoFieldsEnum.acquisition_interval],
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
        ClinicalInfoFieldsEnum.survival_time,
        {
          conflictingSpecimenSubmitterIds: specimenIdsWithTimeConflicts,
        },
      ),
    );
  }
}
