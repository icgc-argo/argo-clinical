import {
  FieldsEnum,
  DataValidationErrors,
  SubmittedClinicalRecord,
  SubmissionValidationError,
  ClinicalInfoFieldsEnum,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import { FileType } from '../submission-api';
import * as utils from './utils';

export const validate = async (
  newRecords: DeepReadonly<{ [clinicalType: string]: SubmittedClinicalRecord }>,
  existentDonor: DeepReadonly<Donor>,
): Promise<any> => {
  const errors: SubmissionValidationError[] = [];
  const donorRecord = newRecords[FileType.DONOR];

  // Preconditions: if any one of these validation failed, can't continue
  if (!utils.checkDonorRegistered(existentDonor, donorRecord)) {
    return [
      utils.buildSubmissionError(
        donorRecord,
        DataValidationErrors.ID_NOT_REGISTERED,
        FieldsEnum.submitter_donor_id,
      ),
    ];
  }

  // cross entity donor record validation
  checkTimeConflictWithSpecimen(existentDonor, donorRecord, newRecords[FileType.SPECIMEN], errors);

  if (errors.length > 0) {
    return errors;
  } else {
    return calculateStats(donorRecord, existentDonor);
  }
};

// cases
// 1 not changing specimenType or tnd and new clinicalInfo <=> new
// 2 changing specimenType or tnd or changing clinicalInfo <=> update
// 3 not new or update <=> noUpdate
function calculateStats(record: DeepReadonly<SubmittedClinicalRecord>, donor: DeepReadonly<Donor>) {
  const clinicalInfo = donor.clinicalInfo;

  // no updates to specimenType or tnd but there is now existent clinicalInfo, new
  if (donor.gender === record[FieldsEnum.gender] && !clinicalInfo) {
    return { new: record.index };
  }

  // check changing fields
  const updateFields: any[] = utils.getUpdatedFields(clinicalInfo, record);

  if (donor.gender !== record[FieldsEnum.gender]) {
    updateFields.push({
      fieldName: FieldsEnum.sample_type,
      index: record.index,
      info: {
        oldValue: donor.gender,
        newValue: record[FieldsEnum.gender],
      },
    });
  }

  return updateFields.length === 0 ? { noUpdate: record.index } : { updateFields };
}

function checkTimeConflictWithSpecimen(
  donor: DeepReadonly<Donor>,
  donorRecord: DeepReadonly<SubmittedClinicalRecord>,
  specimenRecord: DeepReadonly<SubmittedClinicalRecord>,
  errors: SubmissionValidationError[],
) {
  if (donorRecord[ClinicalInfoFieldsEnum.vital_status] !== 'deceased') {
    return;
  }
  const specimenIdsWithTimeConflicts: string[] = [];
  const donoSurvivalTime: number = Number(donorRecord[ClinicalInfoFieldsEnum.survival_time]);

  donor.specimens.forEach(specimen => {
    let specimenAcqusitionInterval: number = 0;
    // specimenAcqusitionInterval comes from either registered specimen in new record or specimen.clincalInfo
    if (
      specimenRecord &&
      specimenRecord[FieldsEnum.submitter_specimen_id] === specimen.submitterId
    ) {
      specimenAcqusitionInterval = Number(
        specimenRecord[ClinicalInfoFieldsEnum.specimen_acquistion_interval],
      );
    } else if (specimen.clinicalInfo) {
      specimenAcqusitionInterval = Number(specimen.clinicalInfo.specimenAcqusitionInterval);
    } else {
      return; // no specimenAcqusitionInterval so move on to next specimen
    }

    if (donoSurvivalTime < specimenAcqusitionInterval) {
      specimenIdsWithTimeConflicts.push(specimenRecord[FieldsEnum.submitter_specimen_id] as string);
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
          msg: `${ClinicalInfoFieldsEnum.survival_time} can't be less than a specimen's acquistion time`,
          conflictingSpecimenSubmitterIds: specimenIdsWithTimeConflicts,
        },
      ),
    );
  }
}
