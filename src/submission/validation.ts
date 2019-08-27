import { DonorMap } from "../clinical/clinical-entities";
import {
  DataValidationErrors,
  SubmissionValidationError,
  CreateRegistrationRecord,
  ValidationResult,
  FieldsEnum,
  RegistrationToCreateRegistrationFieldsMap
} from "./submission-entities";
import { donorDao, DONOR_FIELDS } from "../clinical/donor-repo";
import { DeepReadonly } from "deep-freeze";
import { DataRecord } from "../lectern-client/schema-entities";
import { FileType } from "./submission-api";

export const validateRegistrationData = async (
  expectedProgram: string,
  newRecords: DeepReadonly<CreateRegistrationRecord[]>,
  existingDonors: DeepReadonly<DonorMap>
): Promise<ValidationResult> => {
  let errors: SubmissionValidationError[] = [];

  // caching in case we encounter same ids more than once
  const newSpecimens = new Set<string>();
  const newSamples = new Set<string>();
  const newDonors = new Set<string>();

  for (let index = 0; index < newRecords.length; index++) {
    const registrationRecord = newRecords[index];

    // checks against db
    errors = errors.concat(mutatingExistingData(index, registrationRecord, existingDonors));
    errors = errors.concat(
      await specimenBelongsToOtherDonor(index, registrationRecord, expectedProgram)
    );
    errors = errors.concat(
      await sampleBelongsToAnotherSpecimen(index, registrationRecord, expectedProgram)
    );

    // cross checking new records in file
    if (
      newDonors.has(registrationRecord.donorSubmitterId) ||
      isNewDonor(registrationRecord, expectedProgram)
    ) {
      newDonors.add(registrationRecord.donorSubmitterId);
      errors = errors.concat(conflictingNewDonor(index, registrationRecord, newRecords));
    }

    if (
      newSpecimens.has(registrationRecord.specimenSubmitterId) ||
      isNewSpecimen(registrationRecord, expectedProgram)
    ) {
      newSpecimens.add(registrationRecord.specimenSubmitterId);
      errors = errors.concat(conflictingNewSpecimen(index, registrationRecord, newRecords));
    }

    if (
      newSamples.has(registrationRecord.sampleSubmitterId) ||
      isNewSample(registrationRecord, expectedProgram)
    ) {
      newSamples.add(registrationRecord.sampleSubmitterId);
      errors = errors.concat(conflictingNewSample(index, registrationRecord, newRecords));
    }
  }

  return {
    errors
  };
};

export const usingInvalidProgramId = (
  type: string,
  newDonorIndex: number,
  record: DataRecord,
  expectedProgram: string
) => {
  const errors: SubmissionValidationError[] = [];
  const programId = record[FieldsEnum.program_id];
  if (programId) {
    if (expectedProgram !== programId) {
      errors.push({
        type: DataValidationErrors.INVALID_PROGRAM_ID,
        fieldName: FieldsEnum.program_id,
        index: newDonorIndex,
        info: getInfoObject(type, record, expectedProgram)
      });
    }
    return errors;
  }
  return [];
};
const getInfoObject = (type: string, record: DeepReadonly<DataRecord>, expectedProgram: string) => {
  switch (type) {
    case FileType.REGISTRATION: {
      return {
        value: record[FieldsEnum.program_id],
        sampleSubmitterId: record[FieldsEnum.submitter_sample_id],
        specimenSubmitterId: record[FieldsEnum.submitter_specimen_id],
        donorSubmitterId: record[FieldsEnum.submitter_donor_id],
        expectedProgram
      };
    }
    case FileType.DONOR:
    case FileType.SPECIMEN:
    case FileType.SAMPLE: {
      return {
        value: record[FieldsEnum.program_id],
        donorSubmitterId: record[FieldsEnum.submitter_donor_id],
        expectedProgram
      };
    }
  }
  return {};
};

const conflictingNewSpecimen = (
  newDonorIndex: number,
  newDonor: CreateRegistrationRecord,
  newRecords: DeepReadonly<CreateRegistrationRecord[]>
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
      if (newDonor.specimenType !== rec.specimenType) {
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
        FieldsEnum.submitter_specimen_id,
        newDonorIndex,
        {
          conflictingRows: conflictingSpecimensIndices
        }
      )
    );
  }

  if (conflictingSpecimenTypesIndices.length !== 0) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.NEW_SPECIMEN_ATTR_CONFLICT,
        FieldsEnum.specimen_type,
        newDonorIndex,
        {
          conflictingRows: conflictingSpecimenTypesIndices
        }
      )
    );
  }

  if (conflictingSpecimenTumourDesignationIndices.length !== 0) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.NEW_SPECIMEN_ATTR_CONFLICT,
        FieldsEnum.tumour_normal_designation,
        newDonorIndex,
        {
          conflictingRows: conflictingSpecimenTumourDesignationIndices
        }
      )
    );
  }

  return errors;
};

const conflictingNewDonor = (
  newDonorIndex: number,
  newDonor: CreateRegistrationRecord,
  newRecords: DeepReadonly<CreateRegistrationRecord[]>
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
      FieldsEnum.gender,
      newDonorIndex,
      {
        conflictingRows: conflictingGendersIndexes
      }
    );
    errors.push(err);
  }
  return errors;
};

const conflictingNewSample = (
  newDonorIndex: number,
  newDonor: CreateRegistrationRecord,
  newRecords: DeepReadonly<CreateRegistrationRecord[]>
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
      FieldsEnum.submitter_sample_id,
      newDonorIndex,
      {
        conflictingRows: conflictingSamplesIndices
      }
    );
    errors.push(err);
  }

  if (conflictingSampleTypesIndices.length !== 0) {
    const err = buildError(
      newDonor,
      DataValidationErrors.NEW_SAMPLE_ATTR_CONFLICT,
      FieldsEnum.sample_type,
      newDonorIndex,
      {
        conflictingRows: conflictingSampleTypesIndices
      }
    );
    errors.push(err);
  }
  return errors;
};

const isNewSpecimen = async (
  newDonor: DeepReadonly<CreateRegistrationRecord>,
  programId: string
) => {
  const count = await donorDao.countBy({
    [DONOR_FIELDS.PROGRAM_ID]: { $eq: programId },
    [DONOR_FIELDS.SPECIMEN_SUBMITTER_ID]: { $eq: newDonor.specimenSubmitterId }
  });

  return count == 0;
};

const isNewDonor = async (newDonor: DeepReadonly<CreateRegistrationRecord>, programId: string) => {
  const count = await donorDao.countBy({
    [DONOR_FIELDS.PROGRAM_ID]: { $eq: programId },
    [DONOR_FIELDS.SUBMITTER_ID]: { $eq: newDonor.donorSubmitterId }
  });

  return count == 0;
};

const isNewSample = async (newDonor: DeepReadonly<CreateRegistrationRecord>, programId: string) => {
  const count = await donorDao.countBy({
    [DONOR_FIELDS.PROGRAM_ID]: { $eq: programId },
    [DONOR_FIELDS.SPECIMEN_SAMPLE_SUBMITTER_ID]: { $eq: newDonor.sampleSubmitterId }
  });

  return count == 0;
};

const mutatingExistingData = (
  index: number,
  newDonor: CreateRegistrationRecord,
  existingDonors: DeepReadonly<DonorMap>
) => {
  // if the donor doesn't exist => return
  const errors: SubmissionValidationError[] = [];
  const existingDonor = existingDonors[newDonor.donorSubmitterId];
  if (!existingDonor) return errors;

  // we don't check program id here because we check it specifically in the program validation

  if (newDonor.gender != existingDonor.gender) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.MUTATING_EXISTING_DATA,
        FieldsEnum.gender,
        index,
        {}
      )
    );
  }

  // if specimen doesn't exist => return
  const existingSpecimen = existingDonor.specimens.find(
    s => s.submitterId === newDonor.specimenSubmitterId
  );
  if (!existingSpecimen) return errors;

  if (newDonor.specimenType !== existingSpecimen.specimenType) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.MUTATING_EXISTING_DATA,
        FieldsEnum.specimen_type,
        index,
        {}
      )
    );
  }

  if (newDonor.tumourNormalDesignation !== existingSpecimen.tumourNormalDesignation) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.MUTATING_EXISTING_DATA,
        FieldsEnum.tumour_normal_designation,
        index,
        {}
      )
    );
  }

  // if sample does exist => check mutations
  const sample = existingSpecimen.samples.find(sa => sa.submitterId === newDonor.sampleSubmitterId);
  if (!sample) return errors;

  if (newDonor.sampleType !== sample.sampleType) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.MUTATING_EXISTING_DATA,
        FieldsEnum.sample_type,
        index,
        {}
      )
    );
  }
  return errors;
};

const specimenBelongsToOtherDonor = async (
  index: number,
  newDonor: CreateRegistrationRecord,
  programId: string
) => {
  const errors: SubmissionValidationError[] = [];
  const count = await donorDao.countBy({
    [DONOR_FIELDS.PROGRAM_ID]: { $eq: programId },
    [DONOR_FIELDS.SUBMITTER_ID]: { $ne: newDonor.donorSubmitterId },
    [DONOR_FIELDS.SPECIMEN_SUBMITTER_ID]: { $eq: newDonor.specimenSubmitterId }
  });
  if (count > 0) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.SPECIMEN_BELONGS_TO_OTHER_DONOR,
        FieldsEnum.submitter_specimen_id,
        index,
        {}
      )
    );
  }
  return errors;
};

const sampleBelongsToAnotherSpecimen = async (
  index: number,
  newDonor: CreateRegistrationRecord,
  programId: string
) => {
  const errors: SubmissionValidationError[] = [];
  const count = await donorDao.countBy({
    [DONOR_FIELDS.PROGRAM_ID]: { $eq: programId },
    [DONOR_FIELDS.SPECIMEN_SUBMITTER_ID]: { $ne: newDonor.specimenSubmitterId },
    [DONOR_FIELDS.SPECIMEN_SAMPLE_SUBMITTER_ID]: { $eq: newDonor.sampleSubmitterId }
  });

  if (count > 0) {
    errors.push(
      buildError(
        newDonor,
        DataValidationErrors.SAMPLE_BELONGS_TO_OTHER_SPECIMEN,
        FieldsEnum.submitter_sample_id,
        index,
        {}
      )
    );
  }

  return errors;
};

const buildError = (
  newDonor: CreateRegistrationRecord,
  type: DataValidationErrors,
  fieldName: FieldsEnum,
  index: number,
  info: object = {}
): SubmissionValidationError => {
  return {
    type,
    fieldName,
    index,
    info: {
      ...info,
      donorSubmitterId: newDonor.donorSubmitterId,
      specimenSubmitterId: newDonor.specimenSubmitterId,
      sampleSubmitterId: newDonor.sampleSubmitterId,
      value: newDonor[RegistrationToCreateRegistrationFieldsMap[fieldName]]
    }
  };
};
