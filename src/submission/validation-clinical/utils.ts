import {
  FieldsEnum,
  SubmittedClinicalRecord,
  DataValidationErrors,
  SubmissionValidationError,
  ModificationType,
  SubmissionValidationUpdate,
  RecordValidationResult,
  ClinicalEntityType,
  SubmittedClinicalRecordsMap,
  ClinicalUniqueIndentifier,
  DonorFieldsEnum,
  SpecimenFieldsEnum,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { validationErrorMessage } from '../submission-error-messages';
import _ from 'lodash';
import { DataRecord } from '../../lectern-client/schema-entities';

export const buildSubmissionError = (
  newRecord: SubmittedClinicalRecord,
  type: any, // will type later
  fieldName: string, // generalized, will type later
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
  fieldName: FieldsEnum | string,
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
    fieldName: FieldsEnum | DonorFieldsEnum | SpecimenFieldsEnum;
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

export const usingInvalidProgramId = (
  type: ClinicalEntityType,
  newDonorIndex: number,
  record: DataRecord,
  expectedProgram: string,
) => {
  const errors: SubmissionValidationError[] = [];
  const programId = record[FieldsEnum.program_id];
  if (programId) {
    if (expectedProgram !== programId) {
      errors.push({
        type: DataValidationErrors.INVALID_PROGRAM_ID,
        fieldName: FieldsEnum.program_id,
        index: newDonorIndex,
        info: getSubmissionErrorInfoObject(type, record, expectedProgram),
        message: validationErrorMessage(DataValidationErrors.INVALID_PROGRAM_ID),
      });
    }
    return errors;
  }
  return [];
};

const getSubmissionErrorInfoObject = (
  type: ClinicalEntityType,
  record: DeepReadonly<DataRecord>,
  expectedProgram: string,
) => {
  switch (type) {
    case ClinicalEntityType.REGISTRATION: {
      return {
        value: record[FieldsEnum.program_id],
        sampleSubmitterId: record[FieldsEnum.submitter_sample_id],
        specimenSubmitterId: record[FieldsEnum.submitter_specimen_id],
        donorSubmitterId: record[FieldsEnum.submitter_donor_id],
        expectedProgram,
      };
    }
    default: {
      return {
        value: record[FieldsEnum.program_id],
        donorSubmitterId: record[FieldsEnum.submitter_donor_id],
        expectedProgram,
      };
    }
  }
};

// how to use example:
// existentDonor.specimens[submitterId === specimenRecord[submitter_specimen_id]].clinicalInfo
// const specimenClinicalInfo = utils.getAtPath(existentDonor, [
//   'specimens',
//   {
//     submitterId: specimenRecord[FieldsEnum.submitter_specimen_id],
//   },
//   'clinicalInfo',
// ]);
export function getAtPath(object: any, nodes: any[]) {
  let objectAtNode: any = { ...object };

  nodes.forEach((n: any) => {
    if (!objectAtNode) return undefined; // no object so stop

    if (typeof n === 'object') {
      if (!Array.isArray(objectAtNode)) throw new Error("Can't apply object node with out array");
      objectAtNode = _.find(objectAtNode, n) || undefined;
    } else if (typeof n === 'string' || typeof n === 'number') {
      objectAtNode = objectAtNode[n] || undefined;
    }
  });

  return objectAtNode || {};
}

export function getValuesFromRecordOrClinicalInfo(
  record: any,
  clinicalInfo: any,
  desiredValueNames: string[],
) {
  const sourceObj = { ...clinicalInfo, ...record };

  const desiredValuesMap: { [valueName: string]: any } = {};
  const missingFields: string[] = [];

  desiredValueNames.forEach(vn => {
    if (sourceObj[vn]) {
      desiredValuesMap[vn] = sourceObj[vn];
    } else {
      missingFields.push(vn);
    }
  });

  return { desiredValuesMap, missingFields };
}
