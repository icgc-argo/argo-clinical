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
  DonorRecordsOrganizer,
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

export namespace DonorRecordsOrganizerOperations {
  // this function will mutate a DonorRecordsOrganizer
  export function addRecord(
    type: ClinicalEntityType,
    records: DonorRecordsOrganizer,
    record: SubmittedClinicalRecord,
  ) {
    switch (type) {
      case ClinicalEntityType.PRIMARY_DIAGNOSIS:
      case ClinicalEntityType.DONOR: {
        records[type] = record;
        break;
      }
      case ClinicalEntityType.SPECIMEN: {
        if (!records[type]) {
          records[type] = [];
        }
        (records[type] as SubmittedClinicalRecord[]).push(record as SubmittedClinicalRecord);
        break;
      }
      default:
        throw new Error(`Can't add record with type: ${type}`);
    }
  }

  export function getRecordsAsArray(
    type: ClinicalEntityType,
    records: DeepReadonly<DonorRecordsOrganizer>,
  ): ReadonlyArray<SubmittedClinicalRecord> {
    const recordsOfInterest = records[type];
    if (!recordsOfInterest) {
      return [];
    } else if (Array.isArray(recordsOfInterest)) {
      return recordsOfInterest;
    } else {
      return [recordsOfInterest as SubmittedClinicalRecord];
    }
  }

  export function getDonorRecord(
    records: DeepReadonly<DonorRecordsOrganizer>,
  ): DeepReadonly<SubmittedClinicalRecord> {
    return records[ClinicalEntityType.DONOR] as SubmittedClinicalRecord;
  }

  export function getSpecimenRecords(
    records: DeepReadonly<DonorRecordsOrganizer>,
  ): DeepReadonly<SubmittedClinicalRecord[]> {
    return records[ClinicalEntityType.SPECIMEN] as SubmittedClinicalRecord[];
  }

  export function getSpecimenRecordBySubmitterId(
    submitter_specimen_id: string,
    records: DeepReadonly<DonorRecordsOrganizer>,
  ): DeepReadonly<SubmittedClinicalRecord> {
    return _.find(records[ClinicalEntityType.SPECIMEN], [
      FieldsEnum.submitter_specimen_id,
      submitter_specimen_id,
    ]) as SubmittedClinicalRecord;
  }

  export function getPrimaryDiagnosisRecord(
    records: DeepReadonly<DonorRecordsOrganizer>,
  ): DeepReadonly<SubmittedClinicalRecord> {
    return records[ClinicalEntityType.PRIMARY_DIAGNOSIS] as SubmittedClinicalRecord;
  }
}
