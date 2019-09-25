import {
  SubmittedClinicalRecord,
  FieldsEnum,
  DataValidationErrors,
  ValidatorResult,
  ModificationType,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Sample, Specimen } from '../../clinical/clinical-entities';
import { FileType } from '../submission-api';
import * as utils from './utils';
import _ from 'lodash';

export const validate = async (
  newDonorRecords: DeepReadonly<{ [clinicalType: string]: SubmittedClinicalRecord }>,
  existentDonor: DeepReadonly<Donor>,
): Promise<ValidatorResult> => {
  const sampleRecord = newDonorRecords[FileType.SAMPLE];

  // Preconditions
  if (!utils.checkDonorRegistered(existentDonor, sampleRecord)) {
    return utils.buildValidatorResult(ModificationType.ERRORSFOUND, sampleRecord.index, [
      utils.buildSubmissionError(
        sampleRecord,
        DataValidationErrors.ID_NOT_REGISTERED,
        FieldsEnum.submitter_donor_id,
      ),
    ]);
  }
  const specimen = _.find(existentDonor.specimens, [
    'submitterId',
    sampleRecord[FieldsEnum.submitter_specimen_id],
  ]);
  if (!specimen) {
    return utils.buildValidatorResult(ModificationType.ERRORSFOUND, sampleRecord.index, [
      utils.buildSubmissionError(
        sampleRecord,
        DataValidationErrors.ID_NOT_REGISTERED,
        FieldsEnum.submitter_specimen_id,
      ),
    ]);
  }
  const sample = _.find(specimen.samples, [
    'submitterId',
    sampleRecord[FieldsEnum.submitter_sample_id],
  ]);
  if (!sample) {
    return utils.buildValidatorResult(ModificationType.ERRORSFOUND, sampleRecord.index, [
      utils.buildSubmissionError(
        sampleRecord,
        DataValidationErrors.ID_NOT_REGISTERED,
        FieldsEnum.submitter_sample_id,
      ),
    ]);
  }

  // TBD: no error checks yet

  return await checkForUpdates(sampleRecord, sample);
};

async function checkForUpdates(
  record: DeepReadonly<SubmittedClinicalRecord>,
  sample: DeepReadonly<Sample>,
): Promise<ValidatorResult> {
  const updatedFields: any[] = [];

  if (sample.sampleType !== record[FieldsEnum.sample_type]) {
    updatedFields.push(
      utils.buildSubmissionUpdate(record, sample.sampleType, FieldsEnum.sample_type),
    );
  }

  return updatedFields.length === 0
    ? utils.buildValidatorResult(ModificationType.NOUPDATE, record.index)
    : utils.buildValidatorResult(ModificationType.UPDATED, record.index, updatedFields);
}
