import { DonorMap } from "../clinical/clinical-entities";
import {
  DataValidationErrors,
  RegistrationValidationError,
  RegistrationRecord,
  CreateRegistrationRecord,
  ValidationResult
} from "./submission-entities";
import { donorDao, DONOR_FIELDS } from "../clinical/donor-repo";
import { DeepReadonly } from "deep-freeze";

export const validateRegistrationData = async (
  expectedProgram: string,
  newRecords: DeepReadonly<CreateRegistrationRecord[]>,
  existingDonors: DeepReadonly<DonorMap>
): Promise<ValidationResult> => {
  let errors: RegistrationValidationError[] = [];

  // caching in case we encounter same ids more than once
  const newSpecimens = new Set<string>();
  const newSamples = new Set<string>();

  for (let index = 0; index < newRecords.length; index++) {
    const registrationRecord = newRecords[index];

    // checks against db
    errors = errors.concat(usingInvalidProgramId(index, registrationRecord, expectedProgram));
    errors = errors.concat(mutatingExistingData(index, registrationRecord, existingDonors));
    errors = errors.concat(await specimenBelongsToOtherDonor(index, registrationRecord));
    errors = errors.concat(await sampleBelongsToAnotherSpecimen(index, registrationRecord));

    // cross checking new records in file
    if (
      newSpecimens.has(registrationRecord.specimenSubmitterId) ||
      isNewSpecimen(registrationRecord)
    ) {
      newSpecimens.add(registrationRecord.specimenSubmitterId);
      errors = errors.concat(conflictingNewSpecimen(index, registrationRecord, newRecords));
    }

    if (newSamples.has(registrationRecord.sampleSubmitterId) || isNewSample(registrationRecord)) {
      newSamples.add(registrationRecord.sampleSubmitterId);
      errors = errors.concat(conflictingNewSample(index, registrationRecord, newRecords));
    }
  }

  return {
    errors
  };
};

const usingInvalidProgramId = (
  newDonorIndex: number,
  registrationRecord: CreateRegistrationRecord,
  expectedProgram: string
) => {
  const errors: RegistrationValidationError[] = [];
  if (expectedProgram !== registrationRecord.programId) {
    errors.push(
      buildError(
        DataValidationErrors.INVALID_PROGRAM_ID,
        "program_id",
        newDonorIndex,
        registrationRecord.donorSubmitterId,
        {
          expectedProgram
        }
      )
    );
  }
  return errors;
};

const conflictingNewSpecimen = (
  newDonorIndex: number,
  newDonor: CreateRegistrationRecord,
  newRecords: DeepReadonly<CreateRegistrationRecord[]>
) => {
  const errors: RegistrationValidationError[] = [];

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
        DataValidationErrors.NEW_SPECIMEN_CONFLICT,
        "specimen_submitter_id",
        newDonorIndex,
        newDonor.donorSubmitterId,
        {
          conflictingRows: conflictingSpecimensIndices
        }
      )
    );
  }

  if (conflictingSpecimenTypesIndices.length !== 0) {
    errors.push(
      buildError(
        DataValidationErrors.NEW_SPECIMEN_CONFLICT,
        "specimen_type",
        newDonorIndex,
        newDonor.donorSubmitterId,
        {
          conflictingRows: conflictingSpecimenTypesIndices
        }
      )
    );
  }

  if (conflictingSpecimenTumourDesignationIndices.length !== 0) {
    errors.push(
      buildError(
        DataValidationErrors.NEW_SPECIMEN_CONFLICT,
        "tumour_normal_designation",
        newDonorIndex,
        newDonor.donorSubmitterId,
        {
          conflictingRows: conflictingSpecimenTumourDesignationIndices
        }
      )
    );
  }

  return errors;
};

const conflictingNewSample = (
  newDonorIndex: number,
  newDonor: CreateRegistrationRecord,
  newRecords: DeepReadonly<CreateRegistrationRecord[]>
) => {
  const errors: RegistrationValidationError[] = [];
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

    // different donor and/or different sample
    if (newDonor.sampleSubmitterId === rec.sampleSubmitterId) {
      conflictingSamplesIndices.push(index);
    }
  });

  if (conflictingSamplesIndices.length !== 0) {
    const err = buildError(
      DataValidationErrors.NEW_SAMPLE_CONFLICT,
      "sample_submitter_id",
      newDonorIndex,
      newDonor.donorSubmitterId,
      {
        conflictingRows: conflictingSamplesIndices
      }
    );
    errors.push(err);
  }

  if (conflictingSampleTypesIndices.length !== 0) {
    const err = buildError(
      DataValidationErrors.NEW_SAMPLE_CONFLICT,
      "sample_type",
      newDonorIndex,
      newDonor.donorSubmitterId,
      {
        conflictingRows: conflictingSampleTypesIndices
      }
    );
    errors.push(err);
  }
  return errors;
};

const isNewSpecimen = async (newDonor: DeepReadonly<CreateRegistrationRecord>) => {
  const count = await donorDao.countBy({
    [DONOR_FIELDS.PROGRAM_ID]: { $eq: newDonor.programId },
    [DONOR_FIELDS.SPECIMEN_SUBMITTER_ID]: { $eq: newDonor.specimenSubmitterId }
  });

  return count == 0;
};

const isNewSample = async (newDonor: DeepReadonly<CreateRegistrationRecord>) => {
  const count = await donorDao.countBy({
    [DONOR_FIELDS.PROGRAM_ID]: { $eq: newDonor.programId },
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
  const errors: RegistrationValidationError[] = [];
  const existingDonor = existingDonors[newDonor.donorSubmitterId];
  if (!existingDonor) return errors;

  // we don't check program id here because we check it specifically in the program validation

  if (newDonor.gender != existingDonor.gender) {
    errors.push(
      buildError(
        DataValidationErrors.MUTATING_EXISTING_DATA,
        "gender",
        index,
        newDonor.donorSubmitterId,
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
        DataValidationErrors.MUTATING_EXISTING_DATA,
        "specimen_type",
        index,
        newDonor.donorSubmitterId,
        {}
      )
    );
  }

  if (newDonor.tumourNormalDesignation !== existingSpecimen.tumourNormalDesignation) {
    errors.push(
      buildError(
        DataValidationErrors.MUTATING_EXISTING_DATA,
        "tumour_normal_designation",
        index,
        newDonor.donorSubmitterId,
        {}
      )
    );
  }

  // if sample does exist => true
  const sample = existingSpecimen.samples.find(sa => sa.submitterId === newDonor.sampleSubmitterId);
  if (!sample) return errors;

  if (newDonor.sampleType !== sample.sampleType) {
    errors.push(
      buildError(
        DataValidationErrors.MUTATING_EXISTING_DATA,
        "sample_type",
        index,
        newDonor.donorSubmitterId,
        {}
      )
    );
  }
  return errors;
};

const specimenBelongsToOtherDonor = async (index: number, newDonor: CreateRegistrationRecord) => {
  const errors: RegistrationValidationError[] = [];
  const count = await donorDao.countBy({
    [DONOR_FIELDS.PROGRAM_ID]: { $eq: newDonor.programId },
    [DONOR_FIELDS.SUBMITTER_ID]: { $ne: newDonor.donorSubmitterId },
    [DONOR_FIELDS.SPECIMEN_SUBMITTER_ID]: { $eq: newDonor.specimenSubmitterId }
  });
  if (count > 0) {
    errors.push(
      buildError(
        DataValidationErrors.SPECIMEN_BELONGS_TO_OTHER_DONOR,
        "specimen_submitter_id",
        index,
        newDonor.donorSubmitterId,
        {}
      )
    );
  }
  return errors;
};

const sampleBelongsToAnotherSpecimen = async (
  index: number,
  newDonor: CreateRegistrationRecord
) => {
  const errors: RegistrationValidationError[] = [];
  const count = await donorDao.countBy({
    [DONOR_FIELDS.PROGRAM_ID]: { $eq: newDonor.programId },
    [DONOR_FIELDS.SPECIMEN_SUBMITTER_ID]: { $ne: newDonor.specimenSubmitterId },
    [DONOR_FIELDS.SPECIMEN_SAMPLE_SUBMITTER_ID]: { $eq: newDonor.sampleSubmitterId }
  });

  if (count > 0) {
    errors.push(
      buildError(
        DataValidationErrors.SAMPLE_BELONGS_TO_OTHER_SPECIMEN,
        "sample_submitter_id",
        index,
        newDonor.donorSubmitterId,
        {}
      )
    );
  }

  return errors;
};

const buildError = (
  type: DataValidationErrors,
  fieldName: keyof RegistrationRecord,
  index: number,
  donorSubmitterId: string,
  info: object
): RegistrationValidationError => {
  return { type, donorSubmitterId, fieldName, index, info };
};
