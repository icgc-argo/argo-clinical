import { DonorMap, Specimen, Sample, Donor } from '../../clinical/clinical-entities';
import {
  DataValidationErrors,
  SubmissionValidationError,
  CreateRegistrationRecord,
  ValidationResult,
  SampleRegistrationFieldsEnum,
  RegistrationToCreateRegistrationFieldsMap,
  RecordValidationResult,
  ClinicalTypeValidateResult,
  ClinicalEntitySchemaNames,
  ClinicalUniqueIndentifier,
  ClinicalSubmissionRecordsByDonorIdMap,
  SubmittedClinicalRecordsMap,
} from '../submission-entities';
import { donorDao, DONOR_FIELDS } from '../../clinical/donor-repo';
import { DeepReadonly } from 'deep-freeze';
import { DataRecord } from '../../lectern-client/schema-entities';
import { submissionValidator } from './index';
import { validationErrorMessage } from '../submission-error-messages';
import {
  buildSubmissionError,
  buildClinicalValidationResult,
  buildMultipleRecordValidationResults,
} from './utils';
import _ from 'lodash';
import { ClinicalSubmissionRecordsOperations } from './utils';
import { mergeRecordsMapIntoDonor } from '../submission-to-clinical/merge-submission';

export const validateRegistrationData = async (
  expectedProgram: string,
  newRecords: DeepReadonly<CreateRegistrationRecord[]>,
  existingDonors: DeepReadonly<DonorMap>,
): Promise<ValidationResult> => {
  let errors: SubmissionValidationError[] = [];

  // caching in case we encounter same ids more than once
  const newSpecimens = new Set<string>();
  const newSamples = new Set<string>();
  const newDonors = new Set<string>();

  for (let index = 0; index < newRecords.length; index++) {
    const registrationRecord = newRecords[index];

    // checks against db
    errors = errors.concat(await mutatingExistingData(index, registrationRecord, existingDonors));
    errors = errors.concat(
      await specimenBelongsToOtherDonor(index, registrationRecord, expectedProgram),
    );
    errors = errors.concat(
      await sampleBelongsToAnotherSpecimen(index, registrationRecord, expectedProgram),
    );

    // cross checking new records in file
    if (
      newDonors.has(registrationRecord.donorSubmitterId) ||
      (await isNewDonor(registrationRecord, expectedProgram))
    ) {
      newDonors.add(registrationRecord.donorSubmitterId);
      errors = errors.concat(conflictingNewDonor(index, registrationRecord, newRecords));
    }

    if (
      newSpecimens.has(registrationRecord.specimenSubmitterId) ||
      (await isNewSpecimen(registrationRecord, expectedProgram))
    ) {
      newSpecimens.add(registrationRecord.specimenSubmitterId);
      errors = errors.concat(conflictingNewSpecimen(index, registrationRecord, newRecords));
    }

    if (
      newSamples.has(registrationRecord.sampleSubmitterId) ||
      (await isNewSample(registrationRecord, expectedProgram))
    ) {
      newSamples.add(registrationRecord.sampleSubmitterId);
      errors = errors.concat(conflictingNewSample(index, registrationRecord, newRecords));
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
    .map(type => (recordValidationResultMap[type] = []));

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
      const results = await submissionValidator(clinicalType).validate(
        submittedRecords,
        existentDonor,
        mergedDonor,
      );

      recordValidationResultMap[clinicalType] = _.concat(
        recordValidationResultMap[clinicalType],
        results,
      );
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
    const multipleRecordValidationResults = buildMultipleRecordValidationResults(records, {
      type: DataValidationErrors.ID_NOT_REGISTERED,
      fieldName: SampleRegistrationFieldsEnum.submitter_donor_id,
    });
    recordValidationResultMap[clinicalType].push(...multipleRecordValidationResults);
  }
}

export const checkUniqueRecords = (
  clinicalType: ClinicalEntitySchemaNames,
  newRecords: DeepReadonly<DataRecord[]>,
  useAllRecordValues: boolean = false, // use all record properties so it behaves like duplicate check
): SubmissionValidationError[] => {
  if (clinicalType === ClinicalEntitySchemaNames.REGISTRATION) {
    throw new Error('cannot check unique records for registration here.');
  }

  const uniqueIdName = ClinicalUniqueIndentifier[clinicalType];
  if (!uniqueIdName) useAllRecordValues = true;

  const identifierToIndexMap: { [k: string]: number[] } = {};
  const indexToErrorMap: { [index: number]: SubmissionValidationError } = {};

  newRecords.forEach((record: any, index) => {
    const uniqueIdentiferValue = useAllRecordValues ? JSON.stringify(record) : record[uniqueIdName];

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
      // error object doesn't exist so add it
      indexToErrorMap[recordIndex] = buildSubmissionError(
        { ...record, index: recordIndex },
        DataValidationErrors.FOUND_IDENTICAL_IDS,
        uniqueIdName,
        {
          conflictingRows: sameIdentifiedRecordIndecies.filter(i => i !== recordIndex),
          useAllRecordValues,
        },
      );
    });
  });
  return Object.values(indexToErrorMap);
};

const conflictingNewSpecimen = (
  newDonorIndex: number,
  newDonor: CreateRegistrationRecord,
  newRecords: DeepReadonly<CreateRegistrationRecord[]>,
) => {
  const errors: SubmissionValidationError[] = [];

  // these arrays to store the indices of rows that conflict with the current record we validate
  const conflictingSpecimensIndices: number[] = [];
  const conflictingSpecimenTypesIndices: number[] = [];
  const conflictingSpecimenTumourDesignationIndices: number[] = [];

  newRecords.forEach((rec, index) => {
    // if same record skip
    if (newDonorIndex === index) {
      return;
    }

    // OR if same donor & same new specimen submitterId (check other specimen columns as they should match)
    if (
      newDonor.donorSubmitterId === rec.donorSubmitterId &&
      newDonor.specimenSubmitterId === rec.specimenSubmitterId
    ) {
      if (newDonor.specimenTissueSource !== rec.specimenTissueSource) {
        conflictingSpecimenTypesIndices.push(index);
      }

      if (newDonor.tumourNormalDesignation !== rec.tumourNormalDesignation) {
        conflictingSpecimenTumourDesignationIndices.push(index);
      }

      return;
    }

    // different donor but using same specimenId
    if (newDonor.specimenSubmitterId == rec.specimenSubmitterId) {
      conflictingSpecimensIndices.push(index);
    }
  });

  // if conflicts add them
  if (conflictingSpecimensIndices.length !== 0) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.NEW_SPECIMEN_ID_CONFLICT,
        SampleRegistrationFieldsEnum.submitter_specimen_id,
        newDonorIndex,
        {
          conflictingRows: conflictingSpecimensIndices,
        },
      ),
    );
  }

  if (conflictingSpecimenTypesIndices.length !== 0) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.NEW_SPECIMEN_ATTR_CONFLICT,
        SampleRegistrationFieldsEnum.specimen_tissue_source,
        newDonorIndex,
        {
          conflictingRows: conflictingSpecimenTypesIndices,
        },
      ),
    );
  }

  if (conflictingSpecimenTumourDesignationIndices.length !== 0) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.NEW_SPECIMEN_ATTR_CONFLICT,
        SampleRegistrationFieldsEnum.tumour_normal_designation,
        newDonorIndex,
        {
          conflictingRows: conflictingSpecimenTumourDesignationIndices,
        },
      ),
    );
  }

  return errors;
};

const conflictingNewDonor = (
  newDonorIndex: number,
  newDonor: CreateRegistrationRecord,
  newRecords: DeepReadonly<CreateRegistrationRecord[]>,
) => {
  const errors: SubmissionValidationError[] = [];
  const conflictingGendersIndexes: number[] = [];

  newRecords.forEach((rec, index) => {
    // if same record return
    if (newDonorIndex === index) {
      return;
    }

    // same donor same specimen and sample Ids
    if (newDonor.donorSubmitterId === rec.donorSubmitterId) {
      if (newDonor.gender !== rec.gender) {
        conflictingGendersIndexes.push(index);
      }
      return;
    }
  });

  if (conflictingGendersIndexes.length !== 0) {
    const err = buildError(
      newDonor,
      DataValidationErrors.NEW_DONOR_CONFLICT,
      SampleRegistrationFieldsEnum.gender,
      newDonorIndex,
      {
        conflictingRows: conflictingGendersIndexes,
      },
    );
    errors.push(err);
  }
  return errors;
};

const conflictingNewSample = (
  newDonorIndex: number,
  newDonor: CreateRegistrationRecord,
  newRecords: DeepReadonly<CreateRegistrationRecord[]>,
) => {
  const errors: SubmissionValidationError[] = [];
  const conflictingSamplesIndices: number[] = [];
  const conflictingSampleTypesIndices: number[] = [];

  newRecords.forEach((rec, index) => {
    // if same record return
    if (newDonorIndex === index) {
      return;
    }

    // same donor same specimen and sample Ids
    if (
      newDonor.donorSubmitterId === rec.donorSubmitterId &&
      newDonor.specimenSubmitterId === rec.specimenSubmitterId &&
      newDonor.sampleSubmitterId === rec.sampleSubmitterId
    ) {
      if (newDonor.sampleType !== rec.sampleType) {
        conflictingSampleTypesIndices.push(index);
      } else {
        conflictingSamplesIndices.push(index);
      }

      return;
    }

    // different donor and/or different specimen
    if (newDonor.sampleSubmitterId === rec.sampleSubmitterId) {
      conflictingSamplesIndices.push(index);
    }
  });

  if (conflictingSamplesIndices.length !== 0) {
    const err = buildError(
      newDonor,
      DataValidationErrors.NEW_SAMPLE_ID_CONFLICT,
      SampleRegistrationFieldsEnum.submitter_sample_id,
      newDonorIndex,
      {
        conflictingRows: conflictingSamplesIndices,
      },
    );
    errors.push(err);
  }

  if (conflictingSampleTypesIndices.length !== 0) {
    const err = buildError(
      newDonor,
      DataValidationErrors.NEW_SAMPLE_ATTR_CONFLICT,
      SampleRegistrationFieldsEnum.sample_type,
      newDonorIndex,
      {
        conflictingRows: conflictingSampleTypesIndices,
      },
    );
    errors.push(err);
  }
  return errors;
};

const isNewSpecimen = async (
  newDonor: DeepReadonly<CreateRegistrationRecord>,
  programId: string,
) => {
  const count = await donorDao.countBy({
    [DONOR_FIELDS.PROGRAM_ID]: { $eq: programId },
    [DONOR_FIELDS.SPECIMEN_SUBMITTER_ID]: { $eq: newDonor.specimenSubmitterId },
  });

  return count == 0;
};

const isNewDonor = async (newDonor: DeepReadonly<CreateRegistrationRecord>, programId: string) => {
  const count = await donorDao.countBy({
    [DONOR_FIELDS.PROGRAM_ID]: { $eq: programId },
    [DONOR_FIELDS.SUBMITTER_ID]: { $eq: newDonor.donorSubmitterId },
  });

  return count == 0;
};

const isNewSample = async (newDonor: DeepReadonly<CreateRegistrationRecord>, programId: string) => {
  const count = await donorDao.countBy({
    [DONOR_FIELDS.PROGRAM_ID]: { $eq: programId },
    [DONOR_FIELDS.SPECIMEN_SAMPLE_SUBMITTER_ID]: { $eq: newDonor.sampleSubmitterId },
  });

  return count == 0;
};

const mutatingExistingData = async (
  index: number,
  newDonor: CreateRegistrationRecord,
  existingDonors: DeepReadonly<DonorMap>,
) => {
  // if the donor doesn't exist => return
  const errors: SubmissionValidationError[] = [];
  const existingDonor = existingDonors[newDonor.donorSubmitterId];
  let existingSpecimen: DeepReadonly<Specimen> | undefined = undefined;
  let existingSample: DeepReadonly<Sample> | undefined = undefined;

  if (existingDonor) {
    // we don't check program id here because we check it specifically in the program validation
    checkDonorMutations(newDonor, existingDonor, errors, index);
    existingSpecimen = existingDonor.specimens.find(
      s => s.submitterId === newDonor.specimenSubmitterId,
    );
  }

  if (!existingSpecimen) {
    existingSpecimen = await findExistingSpecimenFromDb(newDonor);
  }

  // is there an existing specimen registered with this submitter Id?
  if (existingSpecimen) {
    checkSpecimenMutations(newDonor, existingSpecimen, errors, index);
    existingSample = existingSpecimen.samples.find(
      sa => sa.submitterId === newDonor.sampleSubmitterId,
    );
  }

  if (!existingSample) {
    existingSample = await findExistingSampleFromDb(newDonor.programId, newDonor.sampleSubmitterId);
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

const specimenBelongsToOtherDonor = async (
  index: number,
  newDonor: CreateRegistrationRecord,
  programId: string,
) => {
  const errors: SubmissionValidationError[] = [];
  const existingDonor = await donorDao.findBySpecimenSubmitterIdAndProgramId({
    programId,
    submitterId: newDonor.specimenSubmitterId,
  });
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

const sampleBelongsToAnotherSpecimen = async (
  index: number,
  newDonor: CreateRegistrationRecord,
  programId: string,
) => {
  const errors: SubmissionValidationError[] = [];
  const existingDonor = await donorDao.findBySampleSubmitterIdAndProgramId({
    programId,
    submitterId: newDonor.sampleSubmitterId,
  });
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
}
