import {
  FieldsEnum,
  DataValidationErrors,
  SubmittedClinicalRecord,
  SubmissionValidationError,
  ClinicalInfoFieldsEnum,
  ValidatorResult,
  ModificationType,
  DonorRecordsObject,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';

export const validate = async (
  newRecords: DonorRecordsObject,
  existentDonor: DeepReadonly<Donor>,
): Promise<ValidatorResult[]> => {
  const errors: SubmissionValidationError[] = [];
  // there can only be one donor record mapped to a donor submitter ID
  const donorRecord = newRecords.getDonorRecord();
  if (!donorRecord) {
    return [];
  }

  // Preconditions: if any one of these validation failed, can't continue
  if (!utils.checkDonorRegistered(existentDonor, donorRecord)) {
    return [
      utils.buildValidatorResult(ModificationType.ERRORSFOUND, donorRecord.index, [
        utils.buildSubmissionError(
          donorRecord,
          DataValidationErrors.ID_NOT_REGISTERED,
          FieldsEnum.submitter_donor_id,
        ),
      ]),
    ];
  }

  // cross entity donor record validation
  checkTimeConflictWithSpecimens(existentDonor, donorRecord, newRecords, errors);

  return errors.length > 0
    ? [utils.buildValidatorResult(ModificationType.ERRORSFOUND, donorRecord.index, errors)]
    : [utils.checkForUpdates(donorRecord, existentDonor.clinicalInfo)];
};

function checkTimeConflictWithSpecimens(
  donor: DeepReadonly<Donor>,
  donorRecord: DeepReadonly<SubmittedClinicalRecord>,
  newRecords: DonorRecordsObject,
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
    const specimenRecord = newRecords.getSpecimenRecordBySubmitterId(specimen.submitterId);
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
