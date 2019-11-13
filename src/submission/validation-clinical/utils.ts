import {
  FieldsEnum,
  SubmittedClinicalRecord,
  DataValidationErrors,
  SubmissionValidationError,
  ClinicalInfoFieldsEnum,
  ModificationType,
  SubmissionValidationUpdate,
  RecordValidationResult,
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
): SubmissionValidationUpdate => {
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

export const buildRecordValidationResult = (
  record: SubmittedClinicalRecord,
  errors: SubmissionValidationError | SubmissionValidationError[],
  clinicalInfo: DeepReadonly<{ [field: string]: string | number } | object> | undefined = {},
): RecordValidationResult => {
  errors = _.concat([], errors); // make sure errors is array
  if (errors.length > 0) {
    return { type: ModificationType.ERRORSFOUND, index: record.index, resultArray: errors };
  }
  return checkForUpdates(record, clinicalInfo);
};

export const buildClinicalValidationResult = (results: RecordValidationResult[]) => {
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
  clinicalInfo: DeepReadonly<{ [field: string]: string | number } | object> | undefined,
): RecordValidationResult => {
  // clinicalInfo empty so new
  if (_.isEmpty(clinicalInfo)) {
    return { type: ModificationType.NEW, index: record.index };
  }

  // check changing fields
  const submissionUpdates: any[] = getUpdatedFields(clinicalInfo, record);

  // if no updates and not new return noUpdate
  return submissionUpdates.length === 0
    ? { type: ModificationType.NOUPDATE, index: record.index }
    : { type: ModificationType.UPDATED, index: record.index, resultArray: submissionUpdates };
};

export const buildCommonRecordValidationResults = (
  records: SubmittedClinicalRecord[],
  commonErrorProperties: {
    type: DataValidationErrors;
    fieldName: FieldsEnum | ClinicalInfoFieldsEnum;
    info: any;
  },
): RecordValidationResult[] => {
  const validationResults = records.map(record => {
    return buildRecordValidationResult(
      record,
      buildSubmissionError(
        record,
        commonErrorProperties.type,
        commonErrorProperties.fieldName,
        commonErrorProperties.info,
      ),
      {},
    );
  });

  return validationResults;
};
