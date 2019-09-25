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
        ClinicalInfoFieldsEnum.specimen_acquistion_interval,
      ),
    ]);
  }

  // cross entity sepecimen record validation
  checkTimeConflictWithDonor(donorDataToValidateWith, specimenRecord, errors);

  return errors.length > 0
    ? utils.buildValidatorResult(ModificationType.ERRORSFOUND, specimenRecord.index, errors)
    : await checkForUpdates(specimenRecord, specimen);
};

function checkTimeConflictWithDonor(
  donorDataToValidateWith: { [k: string]: any },
  specimenRecord: SubmittedClinicalRecord,
  errors: SubmissionValidationError[],
) {
  if (
    donorDataToValidateWith.donorVitalStatus === 'deceased' &&
    donorDataToValidateWith.donorSurvivalTime <
      specimenRecord[ClinicalInfoFieldsEnum.specimen_acquistion_interval]
  ) {
    errors.push(
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        ClinicalInfoFieldsEnum.specimen_acquistion_interval,
        {
          msg: `${ClinicalInfoFieldsEnum.specimen_acquistion_interval} can't be greater than ${ClinicalInfoFieldsEnum.survival_time}`,
        },
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

async function checkForUpdates(
  record: DeepReadonly<SubmittedClinicalRecord>,
  specimen: DeepReadonly<Specimen>,
): Promise<ValidatorResult> {
  const clinicalInfo = specimen.clinicalInfo;

  // no updates to specimenType or tnd but there is no existent clinicalInfo => new
  if (
    specimen.specimenType === record[FieldsEnum.specimen_type] &&
    specimen.tumourNormalDesignation === record[FieldsEnum.tumour_normal_designation] &&
    _.isEmpty(clinicalInfo)
  ) {
    return utils.buildValidatorResult(ModificationType.NEW, record.index);
  }

  // check changing fields
  const updatedFields: any[] = utils.getUpdatedFields(clinicalInfo, record);

  if (specimen.specimenType !== record[FieldsEnum.specimen_type]) {
    updatedFields.push(
      utils.buildSubmissionUpdate(record, specimen.specimenType, FieldsEnum.specimen_type),
    );
  }

  if (specimen.tumourNormalDesignation !== record[FieldsEnum.tumour_normal_designation]) {
    updatedFields.push(
      utils.buildSubmissionUpdate(
        record,
        specimen.tumourNormalDesignation,
        FieldsEnum.tumour_normal_designation,
      ),
    );
  }

  // if no updates and not new return noUpdate
  return updatedFields.length === 0
    ? utils.buildValidatorResult(ModificationType.NOUPDATE, record.index)
    : utils.buildValidatorResult(ModificationType.UPDATED, record.index, updatedFields);
}
