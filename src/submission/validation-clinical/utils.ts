import {
  SampleRegistrationFieldsEnum,
  SubmittedClinicalRecord,
  DataValidationErrors,
  SubmissionValidationError,
  ModificationType,
  SubmissionValidationUpdate,
  RecordValidationResult,
  ClinicalEntitySchemaNames,
  SubmittedClinicalRecordsMap,
  ClinicalUniqueIndentifier,
  DonorFieldsEnum,
  ClinicalFields,
  TreatmentTypeValuesMappedByTherapy,
  ClinicalTherapyType,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { validationErrorMessage } from '../submission-error-messages';
import _ from 'lodash';
import { DataRecord } from '../../lectern-client/schema-entities';
import { Donor, ClinicalInfo } from '../../clinical/clinical-entities';
import { getSingleClinicalEntityFromDonorBySchemanName } from '../submission-to-clinical/submission-to-clinical';
import { donorDao } from '../../clinical/donor-repo';

export const buildSubmissionError = (
  newRecord: SubmittedClinicalRecord,
  type: DataValidationErrors,
  fieldName: ClinicalFields,
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
      donorSubmitterId: newRecord[SampleRegistrationFieldsEnum.submitter_donor_id],
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
  fieldName: SampleRegistrationFieldsEnum | string,
): SubmissionValidationUpdate => {
  // typescript refused to take this directly
  const index: number = newRecord.index;
  return {
    fieldName,
    index,
    info: {
      donorSubmitterId: newRecord[DonorFieldsEnum.submitter_donor_id],
      newValue: `${newRecord[fieldName] || ''}`, // we convert the value to string since lectern may converted it to non string (integer, boolean)
      oldValue: `${oldValue || ''}`,
    },
  };
};

export const buildRecordValidationResult = (
  record: SubmittedClinicalRecord,
  errors: SubmissionValidationError | SubmissionValidationError[],
  existentDonor: DeepReadonly<Donor>,
  clinicalEntitySchemaName: ClinicalEntitySchemaNames,
): RecordValidationResult => {
  errors = _.concat([], errors); // make sure errors is array
  if (errors.length > 0) {
    return { type: ModificationType.ERRORSFOUND, index: record.index, resultArray: errors };
  }
  const uniqueIdValue = record[ClinicalUniqueIndentifier[clinicalEntitySchemaName]];
  const clinicalInfo = getSingleClinicalEntityFromDonorBySchemanName(
    existentDonor,
    clinicalEntitySchemaName,
    uniqueIdValue as string,
  );
  return checkForUpdates(record, clinicalInfo);
};

// cases
// 1 new clinicalInfo <=> new
// 2 changing clinicalInfo <=> update
// 3 not new or update <=> noUpdate
const checkForUpdates = (
  record: DeepReadonly<SubmittedClinicalRecord>,
  clinicalInfo: DeepReadonly<ClinicalInfo> | undefined,
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

const getSubmissionUpdates = (
  clinicalObject: DeepReadonly<ClinicalInfo> | undefined,
  record: SubmittedClinicalRecord,
) => {
  const submissionUpdates: SubmissionValidationUpdate[] = [];
  if (clinicalObject) {
    for (const fieldName in record) {
      // skip the index field
      if (fieldName == 'index' || (!clinicalObject[fieldName] && !record[fieldName])) continue;

      if (clinicalObject[fieldName] !== record[fieldName]) {
        submissionUpdates.push(
          buildSubmissionUpdate(record, `${clinicalObject[fieldName] || ''}`, fieldName),
        );
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

export const buildRecordValidationError = (
  record: SubmittedClinicalRecord,
  errors: SubmissionValidationError | SubmissionValidationError[],
): RecordValidationResult => {
  errors = _.concat([], errors); // make sure errors is array
  return { type: ModificationType.ERRORSFOUND, index: record.index, resultArray: errors };
};

export const buildMultipleRecordValidationErrors = (
  records: ReadonlyArray<SubmittedClinicalRecord>,
  commonErrorProperties: {
    type: DataValidationErrors;
    fieldName: ClinicalFields;
    info?: any;
  },
): RecordValidationResult[] => {
  const validationResults = records.map(record => {
    return buildRecordValidationError(
      record,
      buildSubmissionError(
        record,
        commonErrorProperties.type,
        commonErrorProperties.fieldName,
        commonErrorProperties.info,
      ),
    );
  });

  return validationResults;
};

export namespace ClinicalSubmissionRecordsOperations {
  // this function will mutate a SubmittedRecords
  export function addRecord(
    type: ClinicalEntitySchemaNames,
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
    type: ClinicalEntitySchemaNames,
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
    type: ClinicalEntitySchemaNames,
    records: DeepReadonly<SubmittedClinicalRecordsMap>,
  ): DeepReadonly<SubmittedClinicalRecord[]> {
    checkNotRegistration(type);
    return records[type];
  }

  export function getRecordBySubmitterId(
    type: ClinicalEntitySchemaNames,
    submitter_id: string,
    records: DeepReadonly<SubmittedClinicalRecordsMap>,
  ): DeepReadonly<SubmittedClinicalRecord> {
    // checkNotRegistration(type); typescript wouldn't detect this check
    if (type === ClinicalEntitySchemaNames.REGISTRATION) {
      throw new Error(`Invalid clinical type: ${type}`);
    }
    return _.find(records[type], [
      ClinicalUniqueIndentifier[type],
      submitter_id,
    ]) as SubmittedClinicalRecord;
  }

  function checkNotRegistration(type: ClinicalEntitySchemaNames) {
    if (type === ClinicalEntitySchemaNames.REGISTRATION) {
      throw new Error(`Invalid clinical type: ${type}`);
    }
  }
}

export const usingInvalidProgramId = (
  type: ClinicalEntitySchemaNames,
  newDonorIndex: number,
  record: DataRecord,
  expectedProgram: string,
) => {
  const errors: SubmissionValidationError[] = [];
  const programId = record[SampleRegistrationFieldsEnum.program_id];
  if (programId) {
    if (expectedProgram !== programId) {
      errors.push({
        type: DataValidationErrors.INVALID_PROGRAM_ID,
        fieldName: SampleRegistrationFieldsEnum.program_id,
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
  type: ClinicalEntitySchemaNames,
  record: DeepReadonly<DataRecord>,
  expectedProgram: string,
) => {
  switch (type) {
    case ClinicalEntitySchemaNames.REGISTRATION: {
      return {
        value: record[SampleRegistrationFieldsEnum.program_id],
        sampleSubmitterId: record[SampleRegistrationFieldsEnum.submitter_sample_id],
        specimenSubmitterId: record[SampleRegistrationFieldsEnum.submitter_specimen_id],
        donorSubmitterId: record[SampleRegistrationFieldsEnum.submitter_donor_id],
        expectedProgram,
      };
    }
    default: {
      return {
        value: record[SampleRegistrationFieldsEnum.program_id],
        donorSubmitterId: record[SampleRegistrationFieldsEnum.submitter_donor_id],
        expectedProgram,
      };
    }
  }
};

// ******* common resued functions *******
export function treatmentTypeNotMatchTherapyType(
  treatmentType: string,
  therapyType: ClinicalTherapyType,
): boolean {
  return !TreatmentTypeValuesMappedByTherapy[therapyType].some(ttv => ttv === treatmentType);
}

// check that a donor is not found with the same clinical entity unique identifier
export async function checkClinicalEntityDoesntBelongToOtherDonor(
  clinicalType: ClinicalEntitySchemaNames,
  record: SubmittedClinicalRecord,
  existentDonor: DeepReadonly<Donor>,
  errors: SubmissionValidationError[],
) {
  const expectedSubmitterDonorId = record[SampleRegistrationFieldsEnum.submitter_donor_id];
  const alreadyAssociatedDonor = await donorDao.findByClinicalEntitySubmitterIdAndProgramId(
    {
      programId: existentDonor.programId,
      submitterId: record[ClinicalUniqueIndentifier[clinicalType]] as string,
    },
    clinicalType,
  );
  if (alreadyAssociatedDonor && alreadyAssociatedDonor.submitterId !== expectedSubmitterDonorId) {
    errors.push(
      buildSubmissionError(
        record,
        DataValidationErrors.CLINICAL_ENTITY_BELONGS_TO_OTHER_DONOR,
        ClinicalUniqueIndentifier[clinicalType],
        {
          otherDonorSubmitterId: alreadyAssociatedDonor.submitterId,
          clinicalType: clinicalType,
        },
      ),
    );
  }
}

// how to use example:
// for - existentDonor.specimens[submitterId === specimenRecord[submitter_specimen_id]].clinicalInfo
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
