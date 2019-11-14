import {
  FieldsEnum,
  SubmittedClinicalRecord,
  DataValidationErrors,
  SubmissionValidationError,
  ClinicalInfoFieldsEnum,
  ModificationType,
  SubmissionValidationUpdate,
  RecordValidationResult,
  ClinicalEntityType,
  SubmittedClinicalRecordsMap,
  ClinicalUniqueIndentifier,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import validationErrorMessage from '../submission-error-messages';
import _ from 'lodash';

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

// cases
// 1 new clinicalInfo <=> new
// 2 changing clinicalInfo <=> update
// 3 not new or update <=> noUpdate
const checkForUpdates = (
  record: DeepReadonly<SubmittedClinicalRecord>,
  clinicalInfo: DeepReadonly<{ [field: string]: string | number } | object> | undefined,
): RecordValidationResult => {
  // clinicalInfo empty so new
  if (_.isEmpty(clinicalInfo)) {
    return { type: ModificationType.NEW, index: record.index };
  }

  // check changing fields
  const submissionUpdates: any[] = getSubmissionUpdates(clinicalInfo, record);

  // if no updates and not new return noUpdate
  return submissionUpdates.length === 0
    ? { type: ModificationType.NOUPDATE, index: record.index }
    : { type: ModificationType.UPDATED, index: record.index, resultArray: submissionUpdates };
};

const getSubmissionUpdates = (clinicalObject: any, record: SubmittedClinicalRecord) => {
  const submissionUpdates: SubmissionValidationUpdate[] = [];
  if (clinicalObject) {
    for (const fieldName in clinicalObject) {
      // this is assuming that the field name record and clinicalInfo both have snake casing
      if (clinicalObject[fieldName] !== record[fieldName]) {
        submissionUpdates.push(buildSubmissionUpdate(record, clinicalObject[fieldName], fieldName));
      }
    }
  }
  return submissionUpdates;
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

export const buildMultipleRecordValidationResults = (
  records: ReadonlyArray<SubmittedClinicalRecord>,
  commonErrorProperties: {
    type: DataValidationErrors;
    fieldName: FieldsEnum | ClinicalInfoFieldsEnum;
    info?: any;
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

export namespace ClinicalSubmissionRecordsOperations {
  // this function will mutate a SubmittedRecords
  export function addRecord(
    type: ClinicalEntityType,
    records: SubmittedClinicalRecordsMap,
    record: SubmittedClinicalRecord,
  ) {
    checkNotRegistration(type);
    if (!records[type]) {
      records[type] = [];
    }
    records[type].push(record);
  }

  export function getSingleRecord(
    type: ClinicalEntityType,
    records: DeepReadonly<SubmittedClinicalRecordsMap>,
  ): DeepReadonly<SubmittedClinicalRecord | undefined> {
    checkNotRegistration(type);
    if (!records[type]) {
      return undefined;
    } else if (records[type].length !== 1) {
      throw new Error(`Clinical type [${type}] doesn't have single record`);
    }
    return records[type][0];
  }

  export function getArrayRecords(
    type: ClinicalEntityType,
    records: DeepReadonly<SubmittedClinicalRecordsMap>,
  ): DeepReadonly<SubmittedClinicalRecord[]> {
    checkNotRegistration(type);
    return records[type];
  }

  export function getRecordBySubmitterId(
    type: ClinicalEntityType,
    submitter_id: string,
    records: DeepReadonly<SubmittedClinicalRecordsMap>,
  ): DeepReadonly<SubmittedClinicalRecord> {
    // checkNotRegistration(type); typescript wouldn't detect this check
    if (type === ClinicalEntityType.REGISTRATION) {
      throw new Error(`Invalid clinical type: ${type}`);
    }
    return _.find(records[type], [
      ClinicalUniqueIndentifier[type],
      submitter_id,
    ]) as SubmittedClinicalRecord;
  }

  function checkNotRegistration(type: ClinicalEntityType) {
    if (type === ClinicalEntityType.REGISTRATION) {
      throw new Error(`Invalid clinical type: ${type}`);
    }
  }
}
