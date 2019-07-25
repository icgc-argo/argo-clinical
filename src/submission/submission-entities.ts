/**
 * Represents a valid registration that is not yet committed (in progress)
 */
export interface ActiveRegistration {
  _id?: string;
  readonly programId: string;
  readonly creator: string;
  readonly stats: RegistrationStats;
  readonly records: Array<RegistrationRecord>;
}

export interface RegistrationRecord {
  readonly program_id: string;
  readonly donor_submitter_id: string;
  readonly gender: string;
  readonly specimen_submitter_id: string;
  readonly specimen_type: string;
  readonly tumour_normal_designation: string;
  readonly sample_submitter_id: string;
  readonly sample_type: string;
}

export type DataValidationError = {
  type: DataValidationErrors;
  fieldName: RegistrationFields;
  info: object;
  index: number;
};

export enum DataValidationErrors {
  SPECIMEN_SUBMITTER_ID_TAKEN = "SPECIMEN_SUBMITTER_ID_TAKEN",
  SAMPLE_SUBMITTER_ID_TAKEN = "SAMPLE_SUBMITTER_ID_TAKEN",
  MUTATING_EXISTING_DATA = "MUTATING_EXISTING_DATA",
  SAMPLE_BELONGS_TO_OTHER_SPECIMEN = "SAMPLE_BELONGS_TO_OTHER_SPECIMEN",
  SPECIMEN_BELONGS_TO_OTHER_DONOR = "SPECIMEN_BELONGS_TO_OTHER_DONOR",
  NEW_SPECIMEN_CONFLICT = "NEW_SPECIMEN_CONFLICT",
  NEW_SAMPLE_CONFLICT = "NEW_SAMPLE_CONFLICT",
  INVALID_PROGRAM_ID = "INVALID_PROGRAM_ID"
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
