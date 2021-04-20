/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import {
  SampleRegistrationFieldsEnum,
  SubmittedClinicalRecord,
  DataValidationErrors,
  SubmissionValidationError,
  ModificationType,
  SubmissionValidationUpdate,
  RecordValidationResult,
  SubmittedClinicalRecordsMap,
  TreatmentTypeValuesMappedByTherapy,
} from '../submission-entities';
import {
  ClinicalEntitySchemaNames,
  ClinicalUniqueIdentifier,
  DonorFieldsEnum,
  ClinicalFields,
  ClinicalTherapyType,
} from '../../common-model/entities';
import { DeepReadonly } from 'deep-freeze';
import {
  validationErrorMessage,
  RelatedEntityErrorInfo,
  SubmissionErrorBaseInfo,
} from '../submission-error-messages';
import _ from 'lodash';
import { entities as dictionaryEntities } from '@overturebio-stack/lectern-client';
import { Donor, ClinicalInfo } from '../../clinical/clinical-entities';
import {
  getSingleClinicalEntityFromDonorBySchemanName,
  getSingleClinicalObjectFromDonor,
  getEntitySubmitterIdFieldName,
} from '../../common-model/functions';
import { donorDao, DONOR_DOCUMENT_FIELDS } from '../../clinical/donor-repo';
import { isEmptyString, isValueNotEqual, convertToArray } from '../../utils';

export const buildSubmissionError = (
  newRecord: DeepReadonly<SubmittedClinicalRecord>,
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
    } as SubmissionErrorBaseInfo,
  };
  return {
    ...errorData,
    message: validationErrorMessage(type, errorData),
  };
};

export const buildSubmissionWarning = (
  newRecord: DeepReadonly<SubmittedClinicalRecord>,
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
    } as SubmissionErrorBaseInfo,
  };
  return {
    ...errorData,
    message: validationErrorMessage(type, errorData),
  };
};

export const buildSubmissionUpdate = (
  newRecord: DeepReadonly<SubmittedClinicalRecord>,
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
  record: DeepReadonly<SubmittedClinicalRecord>,
  errors: SubmissionValidationError | SubmissionValidationError[],
  warnings: SubmissionValidationError[],
  existentDonor: DeepReadonly<Donor>,
  clinicalEntitySchemaName: ClinicalEntitySchemaNames,
): RecordValidationResult => {
  const errorsArr = convertToArray(errors);
  if (errorsArr.length > 0) {
    return {
      status: ModificationType.ERRORSFOUND,
      index: record.index,
      errors: errorsArr,
      updates: [],
      warnings: warnings,
    };
  }

  const clinicalInfo = getSingleClinicalEntityFromDonorBySchemanName(
    existentDonor,
    clinicalEntitySchemaName,
    record as ClinicalInfo,
  );

  const rvr = addUpdateStatus(record, clinicalInfo);
  return addWarnings(rvr, warnings);
};

const addWarnings = (rvr: RecordValidationResult, warnings: SubmissionValidationError[]) => {
  return { ...rvr, warnings };
};

// cases
// 1 new clinicalInfo <=> new
// 2 changing clinicalInfo <=> update
// 3 not new or update <=> noUpdate
const addUpdateStatus = (
  record: DeepReadonly<SubmittedClinicalRecord>,
  clinicalInfo: DeepReadonly<ClinicalInfo> | undefined,
): RecordValidationResult => {
  // clinicalInfo empty so new
  if (_.isEmpty(clinicalInfo)) {
    return { status: ModificationType.NEW, index: record.index, warnings: [], updates: [] };
  }

  // check changing fields
  const submissionUpdates: any[] = getSubmissionUpdates(clinicalInfo, record);

  // if no updates and not new return noUpdate
  return submissionUpdates.length === 0
    ? { status: ModificationType.NOUPDATE, index: record.index, warnings: [], updates: [] }
    : {
        status: ModificationType.UPDATED,
        index: record.index,
        updates: submissionUpdates,
        warnings: [],
      };
};

const getSubmissionUpdates = (
  clinicalObject: DeepReadonly<ClinicalInfo> | undefined,
  record: DeepReadonly<SubmittedClinicalRecord>,
) => {
  const submissionUpdates: SubmissionValidationUpdate[] = [];
  if (clinicalObject) {
    for (const fieldName in record) {
      // continue since field is index of record or field has no value in both clinicalObject & record
      if (fieldName == 'index' || (!clinicalObject[fieldName] && !record[fieldName])) continue;

      // field's value is different in clinicalObject and in record, so mark it as update
      if (isValueNotEqual(clinicalObject[fieldName], record[fieldName])) {
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
  let dataWarnings: SubmissionValidationError[] = [];
  results.forEach(result => {
    stats[result.status].push(result.index);
    dataWarnings = dataWarnings.concat(result.warnings);
    if (result.status === ModificationType.UPDATED) {
      dataUpdates = dataUpdates.concat(result.updates as SubmissionValidationUpdate[]);
    } else if (result.status === ModificationType.ERRORSFOUND) {
      dataErrors = dataErrors.concat(result.errors as SubmissionValidationError[]);
    }
  });

  return {
    stats: stats,
    dataWarnings: dataWarnings,
    dataErrors: dataErrors,
    dataUpdates: dataUpdates,
  };
};

export const buildRecordValidationError = (
  record: DeepReadonly<SubmittedClinicalRecord>,
  errors: SubmissionValidationError | SubmissionValidationError[],
): RecordValidationResult => {
  const errorsArr = convertToArray(errors);
  return {
    status: ModificationType.ERRORSFOUND,
    index: record.index,
    errors: errorsArr,
    warnings: [],
    updates: [],
  };
};

export const buildMultipleRecordValidationErrors = (
  records: DeepReadonly<SubmittedClinicalRecord[]>,
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
      ClinicalUniqueIdentifier[type],
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
  record: dictionaryEntities.DataRecord,
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
  record: DeepReadonly<dictionaryEntities.DataRecord>,
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
  treatmentTypes: string[],
  therapyType: ClinicalTherapyType,
): boolean {
  const treatmentTypeFortherapy = TreatmentTypeValuesMappedByTherapy[therapyType];
  return !treatmentTypes.some(t => t === treatmentTypeFortherapy);
}

const ClinicalEntitySchemaNameToDonoFieldsMap: { [clinicalType: string]: DONOR_DOCUMENT_FIELDS } = {
  [ClinicalEntitySchemaNames.TREATMENT]: DONOR_DOCUMENT_FIELDS.TREATMENT_SUBMITTER_ID,
  [ClinicalEntitySchemaNames.FOLLOW_UP]: DONOR_DOCUMENT_FIELDS.FOLLOWUP_SUBMITTER_ID,
  [ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]:
    DONOR_DOCUMENT_FIELDS.PRIMARY_DIAGNOSIS_SUBMITTER_ID,
  [ClinicalEntitySchemaNames.FAMILY_HISTORY]: DONOR_DOCUMENT_FIELDS.FAMILY_HISTORY_ID,
};

// check that a donor is not found with the same clinical entity unique identifier
export async function checkClinicalEntityDoesntBelongToOtherDonor(
  clinicalType: Exclude<
    ClinicalEntitySchemaNames,
    | ClinicalTherapyType
    | ClinicalEntitySchemaNames.FAMILY_HISTORY
    | ClinicalEntitySchemaNames.REGISTRATION
  >,
  record: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  errors: SubmissionValidationError[],
) {
  const expectedSubmitterDonorId = record[SampleRegistrationFieldsEnum.submitter_donor_id];
  const alreadyAssociatedDonor = await donorDao.findByClinicalEntitySubmitterIdAndProgramId(
    {
      programId: existentDonor.programId,
      submitterId: record[ClinicalUniqueIdentifier[clinicalType]] as string,
    },
    ClinicalEntitySchemaNameToDonoFieldsMap[clinicalType],
  );
  if (alreadyAssociatedDonor && alreadyAssociatedDonor.submitterId !== expectedSubmitterDonorId) {
    errors.push(
      buildSubmissionError(
        record,
        DataValidationErrors.CLINICAL_ENTITY_BELONGS_TO_OTHER_DONOR,
        ClinicalUniqueIdentifier[clinicalType],
        {
          otherDonorSubmitterId: alreadyAssociatedDonor.submitterId,
          clinicalType: clinicalType,
        },
      ),
    );
  }
}

export function checkRelatedEntityExists(
  parentEntity: ClinicalEntitySchemaNames,
  record: DeepReadonly<SubmittedClinicalRecord>,
  childEntity: ClinicalEntitySchemaNames,
  mergedDonor: Donor,
  errors: SubmissionValidationError[],
  required: boolean,
) {
  const entitySubmitterIdField = getEntitySubmitterIdFieldName(parentEntity);
  const error = buildSubmissionError(
    record,
    DataValidationErrors.RELATED_ENTITY_MISSING_OR_CONFLICTING,
    entitySubmitterIdField as ClinicalFields,
    {
      fieldName: entitySubmitterIdField,
      childEntity: childEntity,
      parentEntity: parentEntity,
      donorSubmitterId: record.submitter_donor_id,
    } as RelatedEntityErrorInfo,
  );

  if (!required && isEmptyString(record[entitySubmitterIdField] as string)) {
    return;
  }

  if (required && isEmptyString(record[entitySubmitterIdField] as string)) {
    errors.push(error);
    return;
  }

  const relatedEntity = getRelatedEntityByFK(
    parentEntity,
    record[entitySubmitterIdField] as string,
    mergedDonor,
  );

  if (!relatedEntity) {
    errors.push(error);
  }
}

export function getRelatedEntityByFK(
  relatedEntityName: ClinicalEntitySchemaNames,
  fk: string,
  mergedDonor: Donor,
) {
  if (
    relatedEntityName == ClinicalEntitySchemaNames.REGISTRATION ||
    relatedEntityName == ClinicalEntitySchemaNames.CHEMOTHERAPY ||
    relatedEntityName == ClinicalEntitySchemaNames.RADIATION ||
    relatedEntityName == ClinicalEntitySchemaNames.HORMONE_THERAPY ||
    relatedEntityName == ClinicalEntitySchemaNames.IMMUNOTHERAPY ||
    relatedEntityName == ClinicalEntitySchemaNames.FAMILY_HISTORY
  ) {
    throw new Error('method only supports single submitterId as FK');
  }

  const entity = getSingleClinicalObjectFromDonor(mergedDonor, relatedEntityName, {
    clinicalInfo: { [ClinicalUniqueIdentifier[relatedEntityName]]: fk as string },
  });
  return entity;
}
