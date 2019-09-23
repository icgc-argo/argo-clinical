import {
  SubmissionValidationError,
  SubmittedClinicalRecord,
  FieldsEnum,
  RecordToDonorFieldsMap,
  SubmissionValidationUpdate,
  ClinicalInfoFieldsEnum,
  DataValidationErrors
} from "../submission-entities";
import { DeepReadonly } from "deep-freeze";
import { Donor, Sample, Specimen } from "../../clinical/clinical-entities";
import { FileType } from "../submission-api";
import * as utils from "./utils";
import _, { sample } from "lodash";
import DeepDiff from "deep-diff";

export const validate = async (
  newDonorRecords: DeepReadonly<{ [clinicalType: string]: SubmittedClinicalRecord }>,
  existentDonor: DeepReadonly<Donor>
): Promise<any> => {
  // this is a dummy error
  const sampleRecord = newDonorRecords[FileType.SAMPLE];
  let sample: Sample;
  // Preconditions

  if (!utils.checkDonorRegistered(existentDonor, sampleRecord)) {
  }
  const specimen = utils.getRegisteredSubEntityInCollection(
    FieldsEnum.submitter_specimen_id,
    sampleRecord,
    existentDonor.specimens
  ) as Specimen;
  if (!specimen) {
    return [
      utils.buildSubmissionError(
        sampleRecord,
        DataValidationErrors.ID_NOT_REGISTERED,
        FieldsEnum.submitter_specimen_id
      )
    ];
  }
  sample = utils.getRegisteredSubEntityInCollection(
    FieldsEnum.submitter_sample_id,
    sampleRecord,
    specimen.samples
  ) as Sample;
  if (!sample) {
    return [
      utils.buildSubmissionError(
        sampleRecord,
        DataValidationErrors.ID_NOT_REGISTERED,
        FieldsEnum.submitter_specimen_id
      )
    ];
  }

  // no error checks yet

  return calculateStats(sampleRecord, sample);
};

// cases
// 1 not changing sampleType and new clinicalInfo <=> new
// 2 changing sampleType or changing clinicalInfo <=> update
// 3 not new or update <=> noUpdate
function calculateStats(record: SubmittedClinicalRecord, sample: Sample) {
  const updateFields: any[] = [];

  if (sample.sampleType !== record[FieldsEnum.sample_type]) {
    updateFields.push({
      fieldName: FieldsEnum.sample_type,
      index: record.index,
      info: {
        oldValue: sample.sampleType,
        newValue: record[FieldsEnum.sample_type]
      }
    });
  }

  return updateFields.length === 0 ? { noUpdate: record.index } : { updateFields };
}
