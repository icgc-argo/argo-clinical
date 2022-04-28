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
  DonorMap,
  Specimen,
  Sample,
  Donor,
  DonorBySubmitterIdMap,
} from '../../clinical/clinical-entities';
import {
  DataValidationErrors,
  SubmissionValidationError,
  CreateRegistrationRecord,
  ValidationResult,
  SampleRegistrationFieldsEnum,
  RegistrationToCreateRegistrationFieldsMap,
  RecordValidationResult,
  ClinicalTypeValidateResult,
  ClinicalSubmissionRecordsByDonorIdMap,
  SubmittedClinicalRecordsMap,
  IdToIndexMap,
} from '../submission-entities';
import {
  ClinicalEntitySchemaNames,
  ClinicalUniqueIdentifier,
  DonorFieldsEnum,
  ClinicalFields,
} from '../../common-model/entities';
import { donorDao } from '../../clinical/donor-repo';
import { DeepReadonly } from 'deep-freeze';
import { entities as dictionaryEntities } from '@overturebio-stack/lectern-client';
import { submissionValidator } from './index';
import { validationErrorMessage } from '../submission-error-messages';
import {
  buildSubmissionError,
  buildClinicalValidationResult,
  buildMultipleRecordValidationErrors,
  buildRecordValidationResult,
} from './utils';
import { concat } from 'lodash';
import { ClinicalSubmissionRecordsOperations } from './utils';
import { mergeRecordsMapIntoDonor } from '../submission-to-clinical/merge-submission';
import { loggerFor } from '../../logger';

const L = loggerFor(__filename);

export const validateRegistrationData = async (
  newRecords: DeepReadonly<CreateRegistrationRecord[]>,
  allDonorsBySpecimenIdMap: DonorBySubmitterIdMap,
  allDonorsBySampleIdMap: DonorBySubmitterIdMap,
  allDonorsMap: DonorBySubmitterIdMap,
): Promise<ValidationResult> => {
  let errors: SubmissionValidationError[] = [];

  // an index to help faster access to records by key ids to avoid n^2 loop in cross-file validation
  const donorSubmitterIdToSubmittedRecordMap: IdToIndexMap = {};
  const specimenSubmitterIdToSubmittedRecordMap: IdToIndexMap = {};
  const sampleSubmitterIdToSubmittedRecordMap: IdToIndexMap = {};

  // this can be passed and done before when we iterate over the records in submission service. it takes 0.005 secs so
  // not a big gain.
  for (let index = 0; index < newRecords.length; index++) {
    donorSubmitterIdToSubmittedRecordMap[newRecords[index].donorSubmitterId]?.push(index) ||
      (donorSubmitterIdToSubmittedRecordMap[newRecords[index].donorSubmitterId] = [index]);
    specimenSubmitterIdToSubmittedRecordMap[newRecords[index].specimenSubmitterId]?.push(index) ||
      (specimenSubmitterIdToSubmittedRecordMap[newRecords[index].specimenSubmitterId] = [index]);
    sampleSubmitterIdToSubmittedRecordMap[newRecords[index].sampleSubmitterId]?.push(index) ||
      (sampleSubmitterIdToSubmittedRecordMap[newRecords[index].sampleSubmitterId] = [index]);
  }
  for (let index = 0; index < newRecords.length; index++) {
    const donorRecordToValidate = newRecords[index];

    // File VS existing Validation, checks against db data
    errors = errors.concat(
      mutatingExistingData(
        index,
        donorRecordToValidate,
        allDonorsBySpecimenIdMap,
        allDonorsBySampleIdMap,
        allDonorsMap,
      ),
    );

    errors = errors.concat(
      specimenBelongsToOtherDonor(index, donorRecordToValidate, allDonorsBySpecimenIdMap),
    );
    errors = errors.concat(
      sampleBelongsToAnotherSpecimen(index, donorRecordToValidate, allDonorsBySampleIdMap),
    );

    // CROSS-FILE validation, cross checking new records in file for conflicts
    if (allDonorsMap[donorRecordToValidate.donorSubmitterId] === undefined) {
      errors = errors.concat(
        conflictingNewDonor(
          index,
          donorRecordToValidate,
          newRecords,
          donorSubmitterIdToSubmittedRecordMap,
        ),
      );
    }

    if (isNewSpecimen(donorRecordToValidate.specimenSubmitterId, allDonorsBySpecimenIdMap)) {
      errors = errors.concat(
        conflictingNewSpecimen(
          index,
          donorRecordToValidate,
          newRecords,
          specimenSubmitterIdToSubmittedRecordMap,
        ),
      );
    }

    if (isNewSample(donorRecordToValidate.sampleSubmitterId, allDonorsBySampleIdMap)) {
      errors = errors.concat(
        conflictingNewSample(
          index,
          donorRecordToValidate,
          newRecords,
          sampleSubmitterIdToSubmittedRecordMap,
        ),
      );
    }
  }
  return {
    errors,
  };
};

export const validateSubmissionData = async (
  newRecordsToDonorMap: DeepReadonly<ClinicalSubmissionRecordsByDonorIdMap>,
  existingDonors: DeepReadonly<DonorMap>,
): Promise<ClinicalTypeValidateResult> => {
  const recordValidationResultMap: { [clinicalType: string]: RecordValidationResult[] } = {};
  Object.values(ClinicalEntitySchemaNames)
    .filter(type => type != ClinicalEntitySchemaNames.REGISTRATION)
    .forEach(type => (recordValidationResultMap[type] = []));

  for (const donorSubmitterId in newRecordsToDonorMap) {
    const submittedRecords: DeepReadonly<SubmittedClinicalRecordsMap> =
      newRecordsToDonorMap[donorSubmitterId];
    const existentDonor = existingDonors[donorSubmitterId];

    // Check if donor exsists
    if (!existentDonor) {
      addErrorsForNoDonor(submittedRecords, recordValidationResultMap);
      continue;
    }

    const mergedDonor = mergeRecordsMapIntoDonor(submittedRecords, existentDonor);

    // call submission validator or each clinical type
    for (const clinicalType in submittedRecords) {
      const clinicalRecords = submittedRecords[clinicalType];
      for (const record of clinicalRecords) {
        const { errors, warnings } = await submissionValidator(clinicalType).validate(
          record,
          existentDonor,
          mergedDonor,
        );
        const result = buildRecordValidationResult(
          record,
          errors,
          warnings || [],
          existentDonor,
          clinicalType as ClinicalEntitySchemaNames,
        );

        recordValidationResultMap[clinicalType] = concat(
          recordValidationResultMap[clinicalType],
          result,
        );
      }
    }
  }

  const validationResults: ClinicalTypeValidateResult = {};
  Object.entries(recordValidationResultMap).forEach(([clincialType, validatorResults]) => {
    if (validatorResults.length === 0) return;
    validationResults[clincialType] = buildClinicalValidationResult(validatorResults);
  });
  return validationResults;
};

function addErrorsForNoDonor(
  submittedRecords: DeepReadonly<SubmittedClinicalRecordsMap>,
  recordValidationResultMap: { [clinicalType: string]: RecordValidationResult[] },
) {
  for (const clinicalType in submittedRecords) {
    const records = ClinicalSubmissionRecordsOperations.getArrayRecords(
      clinicalType as ClinicalEntitySchemaNames,
      submittedRecords,
    );
    const multipleRecordValidationResults = buildMultipleRecordValidationErrors(records, {
      type: DataValidationErrors.ID_NOT_REGISTERED,
      fieldName: DonorFieldsEnum.submitter_donor_id,
    });
    recordValidationResultMap[clinicalType].push(...multipleRecordValidationResults);
  }
}

export const checkUniqueRecords = (
  clinicalType: ClinicalEntitySchemaNames,
  newRecords: DeepReadonly<dictionaryEntities.DataRecord[]>,
  useAllRecordValues: boolean = false, // use all record properties so it behaves like duplicate check
): SubmissionValidationError[] => {
  if (clinicalType === ClinicalEntitySchemaNames.REGISTRATION) {
    throw new Error('cannot check unique records for registration here.');
  }

  const uniqueIdNames = concat([], ClinicalUniqueIdentifier[clinicalType]) as ClinicalFields[];
  if (!uniqueIdNames) useAllRecordValues = true;

  const identifierToIndexMap: { [k: string]: number[] } = {};
  const indexToErrorMap: { [index: number]: SubmissionValidationError } = {};

  newRecords.forEach((record: any, index) => {
    const uniqueIdentiferValue = useAllRecordValues
      ? JSON.stringify(record)
      : uniqueIdNames.reduce((acc, curr) => acc + record[curr], '');

    // if the id is empty then we don't want a non unique error to show since the id is missing to begin with and that causes double error.
    if (uniqueIdentiferValue.trim() === '') {
      return;
    }

    // only one index so not duplicate
    if (!identifierToIndexMap[uniqueIdentiferValue]) {
      identifierToIndexMap[uniqueIdentiferValue] = [index];
      return;
    }

    identifierToIndexMap[uniqueIdentiferValue].push(index);
    const sameIdentifiedRecordIndecies = identifierToIndexMap[uniqueIdentiferValue];
    sameIdentifiedRecordIndecies.forEach(recordIndex => {
      // error object already exists so just update the duplicateWith list
      if (indexToErrorMap[recordIndex]) {
        indexToErrorMap[recordIndex].info.conflictingRows.push(index);
        return;
      }
      const errorRecord = newRecords[recordIndex] as any;
      // error object doesn't exist so add it
      indexToErrorMap[recordIndex] = buildSubmissionError(
        { ...errorRecord, index: recordIndex },
        DataValidationErrors.FOUND_IDENTICAL_IDS,
        uniqueIdNames.length == 1 ? uniqueIdNames[0] : DonorFieldsEnum.submitter_donor_id, // use donor_id if using multiple fields
        {
          conflictingRows: sameIdentifiedRecordIndecies.filter(i => i !== recordIndex),
          useAllRecordValues,
          uniqueIdNames,
        },
      );
    });
  });
  return Object.values(indexToErrorMap);
};

const conflictingNewSpecimen = (
  donorToValidateRecIndex: number,
  donorToValidateRecord: CreateRegistrationRecord,
  newRecords: DeepReadonly<CreateRegistrationRecord[]>,
  specimenSubmitterIdToSubmittedRecordMap: IdToIndexMap,
) => {
  const errors: SubmissionValidationError[] = [];

  // these arrays to store the indices of rows that conflict with the current record we validate
  const conflictingSpecimensIndices: number[] = [];
  const conflictingSpecimenTissueSourceIndices: number[] = [];
  const conflictingSpecimenTumourDesignationIndices: number[] = [];
  const conflictingSpecimenTypeIndices: number[] = [];

  specimenSubmitterIdToSubmittedRecordMap[donorToValidateRecord.specimenSubmitterId].forEach(
    rowNum => {
      // if same record skip
      if (donorToValidateRecIndex === rowNum) {
        return;
      }
      const recordContainingSameSpecimenId: CreateRegistrationRecord = newRecords[rowNum];
      // OR if same donor & same new specimen submitterId (check other specimen columns as they should match)
      if (
        donorToValidateRecord.donorSubmitterId ===
          recordContainingSameSpecimenId.donorSubmitterId &&
        donorToValidateRecord.specimenSubmitterId ===
          recordContainingSameSpecimenId.specimenSubmitterId
      ) {
        if (
          donorToValidateRecord.specimenTissueSource !==
          recordContainingSameSpecimenId.specimenTissueSource
        ) {
          conflictingSpecimenTissueSourceIndices.push(rowNum);
        }

        if (
          donorToValidateRecord.tumourNormalDesignation !==
          recordContainingSameSpecimenId.tumourNormalDesignation
        ) {
          conflictingSpecimenTumourDesignationIndices.push(rowNum);
        }

        if (donorToValidateRecord.specimenType !== recordContainingSameSpecimenId.specimenType) {
          conflictingSpecimenTypeIndices.push(rowNum);
        }

        return;
      }

      // different donor but using same specimenId
      if (
        donorToValidateRecord.specimenSubmitterId ==
        recordContainingSameSpecimenId.specimenSubmitterId
      ) {
        conflictingSpecimensIndices.push(rowNum);
      }
    },
  );

  // if conflicts add them
  if (conflictingSpecimensIndices.length !== 0) {
    errors.push(
      buildError(
        donorToValidateRecord,
        DataValidationErrors.NEW_SPECIMEN_ID_CONFLICT,
        SampleRegistrationFieldsEnum.submitter_specimen_id,
        donorToValidateRecIndex,
        {
          conflictingRows: conflictingSpecimensIndices,
        },
      ),
    );
  }

  if (conflictingSpecimenTissueSourceIndices.length !== 0) {
    errors.push(
      buildError(
        donorToValidateRecord,
        DataValidationErrors.NEW_SPECIMEN_ATTR_CONFLICT,
        SampleRegistrationFieldsEnum.specimen_tissue_source,
        donorToValidateRecIndex,
        {
          conflictingRows: conflictingSpecimenTissueSourceIndices,
        },
      ),
    );
  }

  if (conflictingSpecimenTumourDesignationIndices.length !== 0) {
    errors.push(
      buildError(
        donorToValidateRecord,
        DataValidationErrors.NEW_SPECIMEN_ATTR_CONFLICT,
        SampleRegistrationFieldsEnum.tumour_normal_designation,
        donorToValidateRecIndex,
        {
          conflictingRows: conflictingSpecimenTumourDesignationIndices,
        },
      ),
    );
  }

  if (conflictingSpecimenTypeIndices.length !== 0) {
    errors.push(
      buildError(
        donorToValidateRecord,
        DataValidationErrors.NEW_SPECIMEN_ATTR_CONFLICT,
        SampleRegistrationFieldsEnum.specimen_type,
        donorToValidateRecIndex,
        {
          conflictingRows: conflictingSpecimenTypeIndices,
        },
      ),
    );
  }

  return errors;
};

const conflictingNewDonor = (
  donorToValidateRecIndex: number,
  donorRecToValidate: CreateRegistrationRecord,
  newRecords: DeepReadonly<CreateRegistrationRecord[]>,
  donorIdSubmitterIdToSubmittedRecordMap: IdToIndexMap,
) => {
  const errors: SubmissionValidationError[] = [];
  const conflictingGendersIndexes: number[] = [];

  // find the other rows in the submitted records that refer to same donor
  donorIdSubmitterIdToSubmittedRecordMap[donorRecToValidate.donorSubmitterId].forEach(rowNum => {
    // if same record return
    if (rowNum === donorToValidateRecIndex) {
      return;
    }
    const recordContainingSameDonorId: CreateRegistrationRecord = newRecords[rowNum];
    // same donor same specimen and sample Ids
    if (donorRecToValidate.donorSubmitterId === recordContainingSameDonorId.donorSubmitterId) {
      if (donorRecToValidate.gender !== recordContainingSameDonorId.gender) {
        conflictingGendersIndexes.push(rowNum);
      }
      return;
    }
  });

  if (conflictingGendersIndexes.length !== 0) {
    const err = buildError(
      donorRecToValidate,
      DataValidationErrors.NEW_DONOR_CONFLICT,
      SampleRegistrationFieldsEnum.gender,
      donorToValidateRecIndex,
      {
        conflictingRows: conflictingGendersIndexes,
      },
    );
    errors.push(err);
  }
  return errors;
};

const conflictingNewSample = (
  donorToValidateIndex: number,
  donorRecToValidate: CreateRegistrationRecord,
  newRecords: DeepReadonly<CreateRegistrationRecord[]>,
  sampleIdSubmitterIdToSubmittedRecordMap: IdToIndexMap,
) => {
  const errors: SubmissionValidationError[] = [];
  const conflictingSamplesIndices: number[] = [];
  const conflictingSampleTypesIndices: number[] = [];

  // get all submitted records that refered the same sample Id as the current Donor we validate
  sampleIdSubmitterIdToSubmittedRecordMap[donorRecToValidate.sampleSubmitterId].forEach(rowNum => {
    // if same record return
    if (donorToValidateIndex === rowNum) {
      return;
    }
    const recordContainingSameSample: CreateRegistrationRecord = newRecords[rowNum];
    // same donor same specimen and sample Ids
    if (
      donorRecToValidate.donorSubmitterId === recordContainingSameSample.donorSubmitterId &&
      donorRecToValidate.specimenSubmitterId === recordContainingSameSample.specimenSubmitterId &&
      donorRecToValidate.sampleSubmitterId === recordContainingSameSample.sampleSubmitterId
    ) {
      if (donorRecToValidate.sampleType !== recordContainingSameSample.sampleType) {
        conflictingSampleTypesIndices.push(rowNum);
      } else {
        conflictingSamplesIndices.push(rowNum);
      }
      return;
    }

    // different donor and/or different specimen
    if (donorRecToValidate.sampleSubmitterId === recordContainingSameSample.sampleSubmitterId) {
      conflictingSamplesIndices.push(rowNum);
    }
  });

  if (conflictingSamplesIndices.length !== 0) {
    const err = buildError(
      donorRecToValidate,
      DataValidationErrors.NEW_SAMPLE_ID_CONFLICT,
      SampleRegistrationFieldsEnum.submitter_sample_id,
      donorToValidateIndex,
      {
        conflictingRows: conflictingSamplesIndices,
      },
    );
    errors.push(err);
  }

  if (conflictingSampleTypesIndices.length !== 0) {
    const err = buildError(
      donorRecToValidate,
      DataValidationErrors.NEW_SAMPLE_ATTR_CONFLICT,
      SampleRegistrationFieldsEnum.sample_type,
      donorToValidateIndex,
      {
        conflictingRows: conflictingSampleTypesIndices,
      },
    );
    errors.push(err);
  }
  return errors;
};

const findSpecimenInAllDonors = (
  specimenSubmitterId: string,
  allDonorsBySpecimenSubmiterId: DonorBySubmitterIdMap,
) => {
  return allDonorsBySpecimenSubmiterId[specimenSubmitterId]?.specimens.find(
    sp => sp.submitterId == specimenSubmitterId,
  );
};

const findSampleInAllDonors = (
  sampleSubmitterId: string,
  allDonorsBySampleSubmitterIdMap: DonorBySubmitterIdMap,
) => {
  const donor = allDonorsBySampleSubmitterIdMap[sampleSubmitterId];
  if (!donor) return;
  for (const sp of donor.specimens) {
    const sample = sp.samples.find(sa => sa.submitterId == sampleSubmitterId);
    if (sample) {
      return sample;
    }
  }
};

const isNewSpecimen = (
  specimenSubmitterId: string,
  allDonorsBySpecimenIdMap: DonorBySubmitterIdMap,
) => {
  return allDonorsBySpecimenIdMap[specimenSubmitterId] === undefined;
};

const isNewSample = (sampleSubmitterId: string, allDonorsBySampleIdMap: DonorBySubmitterIdMap) => {
  return allDonorsBySampleIdMap[sampleSubmitterId] === undefined;
};

const mutatingExistingData = (
  index: number,
  newDonor: CreateRegistrationRecord,
  allDonorsBySpecimenIdMap: DonorBySubmitterIdMap,
  allDonorsBySampleSubmitterIdMap: DonorBySubmitterIdMap,
  allDonorsMap: DonorBySubmitterIdMap,
) => {
  // if the donor doesn't exist => return
  const errors: SubmissionValidationError[] = [];
  const existingDonor = allDonorsMap[newDonor.donorSubmitterId];
  let existingSpecimen: DeepReadonly<Specimen> | undefined = undefined;
  let existingSample: DeepReadonly<Sample> | undefined = undefined;

  if (existingDonor) {
    // we don't check program id here because we check it specifically in the program validation
    checkDonorMutations(newDonor, existingDonor, errors, index);
    existingSpecimen = existingDonor.specimens.find(
      s => s.submitterId === newDonor.specimenSubmitterId,
    );
  }

  // if the specimen id is not in the existing donor
  if (!existingSpecimen) {
    // try to check if this specimen exits even for other donors in db
    // because we show errors of mutation even if the specimen already belongs to donor
    existingSpecimen = findSpecimenInAllDonors(
      newDonor.specimenSubmitterId,
      allDonorsBySpecimenIdMap,
    );
  }

  // is there an existing specimen registered with this submitter Id?
  if (existingSpecimen) {
    checkSpecimenMutations(newDonor, existingSpecimen, errors, index);
    existingSample = existingSpecimen.samples.find(
      sa => sa.submitterId === newDonor.sampleSubmitterId,
    );
  }

  if (!existingSample) {
    // check if another donor in db owns this sample even to show mutation errors.
    existingSample = findSampleInAllDonors(
      newDonor.sampleSubmitterId,
      allDonorsBySampleSubmitterIdMap,
    );
  }

  // if sample does not exist => no need to check mutations, return
  if (!existingSample) return errors;
  checkSampleMutations(newDonor, existingSample, errors, index);
  return errors;
};

const findExistingSampleFromDb = async (programId: string, submitterId: string) => {
  let existingSample: undefined | Sample = undefined;
  const otherDonorWithSameSampleId = await donorDao.findBySampleSubmitterIdAndProgramId({
    programId,
    submitterId,
  });

  if (!otherDonorWithSameSampleId) {
    return undefined;
  }

  let found = false;
  otherDonorWithSameSampleId.specimens.forEach(s => {
    if (found) return;
    existingSample = s.samples.find(sa => sa.submitterId === submitterId);
    if (existingSample) {
      found = true;
    }
  });
  return existingSample;
};

const specimenBelongsToOtherDonor = (
  index: number,
  newDonor: CreateRegistrationRecord,
  allDonorsBySpecimenSubmiterId: DonorBySubmitterIdMap,
) => {
  const errors: SubmissionValidationError[] = [];
  const existingDonor = allDonorsBySpecimenSubmiterId[newDonor.specimenSubmitterId];
  if (existingDonor !== undefined && existingDonor.submitterId !== newDonor.donorSubmitterId) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.SPECIMEN_BELONGS_TO_OTHER_DONOR,
        SampleRegistrationFieldsEnum.submitter_specimen_id,
        index,
        // Value check is to deal with undefined case, which should never occur due to
        { otherDonorSubmitterId: existingDonor ? existingDonor.submitterId : '' },
      ),
    );
  }
  return errors;
};

const sampleBelongsToAnotherSpecimen = (
  index: number,
  newDonor: CreateRegistrationRecord,
  allDonorsBySampleIdMap: DonorBySubmitterIdMap,
) => {
  const errors: SubmissionValidationError[] = [];
  const existingDonor = allDonorsBySampleIdMap[newDonor.sampleSubmitterId];
  if (existingDonor !== undefined) {
    const existingSpecimen = existingDonor.specimens.find(specimen =>
      specimen.samples.some(sample => sample.submitterId === newDonor.sampleSubmitterId),
    );
    if (existingSpecimen && existingSpecimen.submitterId !== newDonor.specimenSubmitterId) {
      errors.push(
        buildError(
          newDonor,
          DataValidationErrors.SAMPLE_BELONGS_TO_OTHER_SPECIMEN,
          SampleRegistrationFieldsEnum.submitter_sample_id,
          index,
          { otherSpecimenSubmitterId: existingSpecimen.submitterId },
        ),
      );
    }
  }
  return errors;
};

const buildError = (
  newDonor: CreateRegistrationRecord,
  type: DataValidationErrors,
  fieldName: SampleRegistrationFieldsEnum,
  index: number,
  info: object = {},
): SubmissionValidationError => {
  const errorData = {
    type,
    fieldName,
    index,
    info: {
      ...info,
      donorSubmitterId: newDonor.donorSubmitterId,
      specimenSubmitterId: newDonor.specimenSubmitterId,
      sampleSubmitterId: newDonor.sampleSubmitterId,
      value: newDonor[RegistrationToCreateRegistrationFieldsMap[fieldName]],
    },
  };

  return {
    message: validationErrorMessage(type, errorData),
    ...errorData,
  };
};

function checkSampleMutations(
  newDonor: CreateRegistrationRecord,
  existingSample: DeepReadonly<Sample>,
  errors: SubmissionValidationError[],
  index: number,
) {
  if (newDonor.sampleType !== existingSample.sampleType) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.MUTATING_EXISTING_DATA,
        SampleRegistrationFieldsEnum.sample_type,
        index,
        { originalValue: existingSample.sampleType },
      ),
    );
  }
}

function checkDonorMutations(
  newDonor: CreateRegistrationRecord,
  existingDonor: DeepReadonly<Donor>,
  errors: SubmissionValidationError[],
  index: number,
) {
  if (newDonor.gender != existingDonor.gender) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.MUTATING_EXISTING_DATA,
        SampleRegistrationFieldsEnum.gender,
        index,
        {
          originalValue: existingDonor.gender,
        },
      ),
    );
  }
}

async function findExistingSpecimenFromDb(newDonor: CreateRegistrationRecord) {
  let existingSpecimen: DeepReadonly<Specimen> | undefined;
  const otherDonorWithSameSpecimenId = await donorDao.findBySpecimenSubmitterIdAndProgramId({
    programId: newDonor.programId,
    submitterId: newDonor.specimenSubmitterId,
  });
  if (otherDonorWithSameSpecimenId) {
    existingSpecimen = otherDonorWithSameSpecimenId.specimens.find(
      s => s.submitterId === newDonor.specimenSubmitterId,
    );
  }
  return existingSpecimen;
}

function checkSpecimenMutations(
  newDonor: CreateRegistrationRecord,
  existingSpecimen: DeepReadonly<Specimen>,
  errors: SubmissionValidationError[],
  index: number,
) {
  if (newDonor.specimenTissueSource !== existingSpecimen.specimenTissueSource) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.MUTATING_EXISTING_DATA,
        SampleRegistrationFieldsEnum.specimen_tissue_source,
        index,
        { originalValue: existingSpecimen.specimenTissueSource },
      ),
    );
  }
  if (newDonor.tumourNormalDesignation !== existingSpecimen.tumourNormalDesignation) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.MUTATING_EXISTING_DATA,
        SampleRegistrationFieldsEnum.tumour_normal_designation,
        index,
        { originalValue: existingSpecimen.tumourNormalDesignation },
      ),
    );
  }
  if (newDonor.specimenType !== existingSpecimen.specimenType) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.MUTATING_EXISTING_DATA,
        SampleRegistrationFieldsEnum.specimen_type,
        index,
        { originalValue: existingSpecimen.specimenType },
      ),
    );
  }
}
