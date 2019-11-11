import {
  FieldsEnum,
  SubmittedClinicalRecord,
  DataValidationErrors,
  SubmissionValidationError,
  ClinicalInfoFieldsEnum,
  ModificationType,
  SubmissionValidationUpdate,
  ValidatorResult,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import validationErrorMessage from '../submission-error-messages';
import _ from 'lodash';

export const checkDonorRegistered = (
  aDonor: DeepReadonly<Donor>,
  record: DeepReadonly<SubmittedClinicalRecord>,
) => {
  return aDonor && aDonor.submitterId === record[FieldsEnum.submitter_donor_id];
};

export const buildSubmissionError = (
  newRecord: SubmittedClinicalRecord,
  type: DataValidationErrors,
  fieldName: FieldsEnum | ClinicalInfoFieldsEnum,
  info: object = {},
): SubmissionValidationError => {
  // typescript refused to take this directly
  const index: number = newRecord.index;
  const errorData = {
    type,
    fieldName,
    index,
    info: {
      ...info,
      donorSubmitterId: newRecord[FieldsEnum.submitter_donor_id],
      value: newRecord[fieldName],
    },
  };
  return {
    ...errorData,
    message: validationErrorMessage(type, errorData),
  };
};

export const buildSubmissionUpdate = (
  newRecord: SubmittedClinicalRecord,
  oldValue: string,
  fieldName: FieldsEnum | ClinicalInfoFieldsEnum | string,
) => {
  // typescript refused to take this directly
  const index: number = newRecord.index;
  return {
    fieldName,
    index,
    info: {
      donorSubmitterId: newRecord[FieldsEnum.submitter_donor_id],
      newValue: `${newRecord[fieldName]}`, // we convert the value to string since lectern may converted it to non string (integer, boolean)
      oldValue: `${oldValue}`,
    },
  };
};

export const buildValidatorResult = (
  type: ModificationType,
  index: number,
  resultArray?: SubmissionValidationError[] | SubmissionValidationUpdate[],
): ValidatorResult => {
  return { type, index, resultArray };
};

export const buildClinicalValidationResult = (results: ValidatorResult[]) => {
  const stats = {
    [ModificationType.NEW]: [] as number[],
    [ModificationType.NOUPDATE]: [] as number[],
    [ModificationType.UPDATED]: [] as number[],
    [ModificationType.ERRORSFOUND]: [] as number[],
  };
  let dataErrors: SubmissionValidationError[] = [];
  let dataUpdates: SubmissionValidationUpdate[] = [];

  results.forEach(result => {
    stats[result.type].push(result.index);
    if (result.type === ModificationType.UPDATED) {
      dataUpdates = dataUpdates.concat(result.resultArray as SubmissionValidationUpdate[]);
    } else if (result.type === ModificationType.ERRORSFOUND) {
      dataErrors = dataErrors.concat(result.resultArray as SubmissionValidationError[]);
    }
  });

  return {
    stats: stats,
    dataErrors: dataErrors,
    dataUpdates: dataUpdates,
  };
};

export const getUpdatedFields = (clinicalObject: any, record: SubmittedClinicalRecord) => {
  const updateFields: any[] = [];
  if (clinicalObject) {
    for (const fieldName in clinicalObject) {
      // this is assuming that the field name record and clinicalInfo both have snake casing
      if (clinicalObject[fieldName] !== record[fieldName]) {
        updateFields.push(buildSubmissionUpdate(record, clinicalObject[fieldName], fieldName));
      }
    }
  }
  return updateFields;
};

// cases
// 1 new clinicalInfo <=> new
// 2 changing clinicalInfo <=> update
// 3 not new or update <=> noUpdate
export const checkForUpdates = (
  record: DeepReadonly<SubmittedClinicalRecord>,
  clinicalObject: DeepReadonly<{ [field: string]: string | number } | object> | undefined,
) => {
  // no updates to specimenTissueSource or tnd but there is no existent clinicalInfo => new
  if (_.isEmpty(clinicalObject)) {
    return buildValidatorResult(ModificationType.NEW, record.index);
  }

  // check changing fields
  const updatedFields: any[] = getUpdatedFields(clinicalObject, record);

  // if no updates and not new return noUpdate
  return updatedFields.length === 0
    ? buildValidatorResult(ModificationType.NOUPDATE, record.index)
    : buildValidatorResult(ModificationType.UPDATED, record.index, updatedFields);
};
