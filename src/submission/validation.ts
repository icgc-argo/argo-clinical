import { CreateRegistrationRecord, ValidationResult } from "./submission-service";
import { DonorMap } from "../clinical/clinical-entities";
import {
  DataValidationErrors,
  RegistrationFields,
  DataValidationError
} from "./submission-entities";
import { donorDao, DONOR_FIELDS } from "../clinical/donor-repo";
import { DeepReadonly } from "deep-freeze";

export const validateRegistrationData = async (
  newRecords: DeepReadonly<CreateRegistrationRecord[]>,
  existingDonors: DeepReadonly<DonorMap>
): Promise<ValidationResult> => {
  let errors: DataValidationError[] = [];
  await newRecords.forEach(async (rec, index) => {
    errors = errors.concat(mutatingExistingData(index, rec, existingDonors));
    errors = errors.concat(await specimenBelongsToOtherDonor(index, rec));
    errors = errors.concat(await sampleBelongsToAnotherSpecimen(index, rec));
  });

  return {
    errors: errors
  };
};

const mutatingExistingData = (
  index: number,
  newDonor: CreateRegistrationRecord,
  existingDonors: DeepReadonly<DonorMap>
) => {
  // if the donor doesn't exist => return
  const errors: DataValidationError[] = [];
  const existingDonor = existingDonors[newDonor.donorSubmitterId];
  if (!existingDonor) return errors;

  if (newDonor.programId != existingDonor.programId) {
    errors.push(
      buildError(DataValidationErrors.MUTATING_EXISTING_DATA, RegistrationFields.PROGRAM_ID, index)
    );
  }

  if (newDonor.gender != existingDonor.gender) {
    errors.push(
      buildError(DataValidationErrors.MUTATING_EXISTING_DATA, RegistrationFields.GENDER, index)
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
        RegistrationFields.SPECIMEN_TYPE,
        index
      )
    );
  }

  if (newDonor.tumourNormalDesignation !== existingSpecimen.tumourNormalDesignation) {
    errors.push(
      buildError(
        DataValidationErrors.MUTATING_EXISTING_DATA,
        RegistrationFields.TUMOUR_NORMAL_DESIGNATION,
        index
      )
    );
  }

  // if sample does exist => true
  const sample = existingSpecimen.samples.find(sa => sa.submitterId === newDonor.sampleSubmitterId);
  if (!sample) return errors;

  if (newDonor.sampleType !== sample.sampleType) {
    errors.push(
      buildError(DataValidationErrors.MUTATING_EXISTING_DATA, RegistrationFields.SAMPLE_TYPE, index)
    );
  }
  return errors;
};

const specimenBelongsToOtherDonor = async (index: number, newDonor: CreateRegistrationRecord) => {
  const errors: DataValidationError[] = [];
  const count = await donorDao.countByExpression({
    [DONOR_FIELDS.SUBMITTER_ID]: { $ne: newDonor.donorSubmitterId },
    [DONOR_FIELDS.SPECIMEN_SUBMITTER_ID]: { $eq: newDonor.specimenSubmitterId }
  });
  if (count > 0) {
    errors.push(
      buildError(
        DataValidationErrors.SPECIMEN_BELONGS_TO_OTHER_DONOR,
        RegistrationFields.SPECIMEN_SUBMITTER_ID,
        index
      )
    );
  }
  return errors;
};

const sampleBelongsToAnotherSpecimen = async (
  index: number,
  newDonor: CreateRegistrationRecord
) => {
  const errors: DataValidationError[] = [];
  const count = await donorDao.countByExpression({
    [DONOR_FIELDS.SPECIMEN_SUBMITTER_ID]: { $ne: newDonor.specimenSubmitterId },
    [DONOR_FIELDS.SPECIMEN_SAMPLE_SUBMITTER_ID]: { $eq: newDonor.sampleSubmitterId }
  });

  if (count > 0) {
    errors.push(
      buildError(
        DataValidationErrors.SAMPLE_BELONGS_TO_OTHER_DONOR_SPECIMEN,
        RegistrationFields.SAMPLE_SUBMITTER_ID,
        index
      )
    );
  }

  return errors;
};

const buildError = (
  errorType: DataValidationErrors,
  fieldName: RegistrationFields,
  index: number
) => {
  return { errorType, fieldName, index };
};
