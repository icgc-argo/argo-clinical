import { DeepReadonly } from "deep-freeze";
import { SchemaValidationErrorTypes } from "../lectern-client/schema-entities";

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

export type RegistrationRecordFields = keyof RegistrationRecord;

export type RegistrationValidationError = {
  type: DataValidationErrors | SchemaValidationErrorTypes;
  fieldName: keyof RegistrationRecord;
  info: object;
  donorSubmitterId: string;
  index: number;
};

export enum DataValidationErrors {
  MUTATING_EXISTING_DATA = "MUTATING_EXISTING_DATA",
  SAMPLE_BELONGS_TO_OTHER_SPECIMEN = "SAMPLE_BELONGS_TO_OTHER_SPECIMEN",
  SPECIMEN_BELONGS_TO_OTHER_DONOR = "SPECIMEN_BELONGS_TO_OTHER_DONOR",
  NEW_SPECIMEN_CONFLICT = "NEW_SPECIMEN_CONFLICT",
  NEW_SAMPLE_CONFLICT = "NEW_SAMPLE_CONFLICT",
  INVALID_PROGRAM_ID = "INVALID_PROGRAM_ID"
}

export type RegistrationStat = { [submitterId: string]: number[] };

export interface RegistrationStats {
  newDonorIds: RegistrationStat;
  newSpecimenIds: RegistrationStat;
  newSampleIds: RegistrationStat;
  alreadyRegistered: RegistrationStat;
}

export interface CreateRegistrationRecord {
  readonly programId: string;
  readonly donorSubmitterId: string;
  readonly gender: string;
  readonly specimenSubmitterId: string;
  readonly specimenType: string;
  readonly tumourNormalDesignation: string;
  readonly sampleSubmitterId: string;
  readonly sampleType: string;
}

export interface CommitRegistrationCommand {
  readonly registrationId: string;
}

export interface CreateRegistrationCommand {
  // we define the records as arbitrary key value pairs to be validated by the schema
  // before we put them in a CreateRegistrationRecord, in case a column is missing so we let dictionary handle error collection.
  records: ReadonlyArray<Readonly<{ [key: string]: string }>>;
  readonly creator: string;
  readonly programId: string;
}

export interface CreateRegistrationResult {
  readonly registration: DeepReadonly<ActiveRegistration> | undefined;
  readonly successful: boolean;
  errors: DeepReadonly<RegistrationValidationError[]>;
}

export interface ValidationResult {
  errors: DeepReadonly<RegistrationValidationError[]>;
}
