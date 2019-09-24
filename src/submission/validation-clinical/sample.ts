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

export const validate = async (
  newDonorRecords: DeepReadonly<{ [clinicalType: string]: SubmittedClinicalRecord }>,
  existentDonor: DeepReadonly<Donor>,
): Promise<ValidatorResult> => {
  // this is a dummy error
  const sampleRecord = newDonorRecords[FileType.SAMPLE];

  // Preconditions
  if (!utils.checkDonorRegistered(existentDonor, sampleRecord)) {
    return {
      type: ModificationType.ERRORSFOUND,
      index: sampleRecord.index,
      resultArray: [
        utils.buildSubmissionError(
          sampleRecord,
          DataValidationErrors.ID_NOT_REGISTERED,
          FieldsEnum.submitter_donor_id,
        ),
      ],
    };
  }
  const specimen = utils.getRegisteredSubEntityInCollection(
    FieldsEnum.submitter_specimen_id,
    sampleRecord,
    existentDonor.specimens,
  ) as Specimen;
  if (!specimen) {
    return {
      type: ModificationType.ERRORSFOUND,
      index: sampleRecord.index,
      resultArray: [
        utils.buildSubmissionError(
          sampleRecord,
          DataValidationErrors.ID_NOT_REGISTERED,
          FieldsEnum.submitter_specimen_id,
        ),
      ],
    };
  }
  const sample: Sample = utils.getRegisteredSubEntityInCollection(
    FieldsEnum.submitter_sample_id,
    sampleRecord,
    specimen.samples,
  ) as Sample;
  if (!sample) {
    return {
      type: ModificationType.ERRORSFOUND,
      index: sampleRecord.index,
      resultArray: [
        utils.buildSubmissionError(
          sampleRecord,
          DataValidationErrors.ID_NOT_REGISTERED,
          FieldsEnum.submitter_sample_id,
        ),
      ],
    };
  }

  // no error checks yet

  return await calculateStats(sampleRecord, sample);
};

async function calculateStats(
  record: SubmittedClinicalRecord,
  sample: Sample,
): Promise<ValidatorResult> {
  const updateFields: any[] = [];

  if (sample.sampleType !== record[FieldsEnum.sample_type]) {
    updateFields.push(
      utils.buildSubmisisonUpdate(record, sample.sampleType, FieldsEnum.sample_type),
    );
  }

  return updateFields.length === 0
    ? { type: ModificationType.NOUPDATE, index: record.index }
    : { type: ModificationType.UPDATED, index: record.index, resultArray: updateFields };
}
