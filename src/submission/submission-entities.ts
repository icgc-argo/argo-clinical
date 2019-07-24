/**
 * Represents a valid registration that is not yet committed (in progress)
 */
export interface ActiveRegistration {
  id?: string;
  readonly programId: string;
  readonly creator: string;
  readonly records: Array<RegistrationRecord>;
}

export interface RegistrationRecord {
  readonly donorSubmitterId: string;
  readonly gender: string;
  readonly specimenSubmitterId: string;
  readonly specimenType: string;
  readonly tumourNormalDesignation: string;
  readonly sampleSubmitterId: string;
  readonly sampleType: string;
}

export type DataValidationError = {
  errorType: DataValidationErrors;
  fieldName: RegistrationFields;
  index: number;
};

export enum DataValidationErrors {
  SAMPLE_ALREADY_ADDED = "SAMPLE_ALREADY_ADDED",
  SPECIMEN_SUBMITTER_ID = "SPECIMEN_SUBMITTER_ID",
  SPECIMEN_SUBMITTER_ID_TAKEN = "SPECIMEN_SUBMITTER_ID_TAKEN",
  SAMPLE_SUBMITTER_ID_TAKEN = "SAMPLE_SUBMITTER_ID_TAKEN",
  MUTATING_EXISTING_DATA = "MUTATING_EXISTING_DATA",
  SAMPLE_BELONGS_TO_OTHER_DONOR_SPECIMEN = "SAMPLE_BELONGS_TO_OTHER_DONOR_SPECIMEN",
  SPECIMEN_BELONGS_TO_OTHER_DONOR = "SPECIMEN_BELONGS_TO_OTHER_DONOR"
}

export enum RegistrationFields {
  SAMPLE_SUBMITTER_ID = "SAMPLE_SUBMITTER_ID",
  SPECIMEN_SUBMITTER_ID = "SPECIMEN_SUBMITTER_ID",
  PROGRAM_ID = "PROGRAM_ID",
  GENDER = "GENDER",
  SPECIMEN_TYPE = "SPECIMEN_TYPE",
  TUMOUR_NORMAL_DESIGNATION = "TUMOUR_NORMAL_DESIGNATION",
  SAMPLE_TYPE = "SAMPLE_TYPE"
}

export type RegistrationStat = { [submitterId: string]: number[] };

export interface RegistrationStats {
  newDonorIds: RegistrationStat;
  newSpecimenIds: RegistrationStat;
  newSampleIds: RegistrationStat;
  alreadyRegistered: RegistrationStat;
}
