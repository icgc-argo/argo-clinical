import { DeepReadonly } from "deep-freeze";
import { SchemaValidationErrorTypes } from "../lectern-client/schema-entities";

/**
 * Represents a valid registration that is not yet committed (in progress)
 */
export interface ActiveRegistration {
  _id?: string;
  readonly programId: string;
  readonly creator: string;
  readonly batchName: string;
  readonly stats: RegistrationStats;
  readonly records: Array<SubmittedRegistrationRecord>;
}

export interface SubmittedRegistrationRecord {
  readonly program_id: string;
  readonly submitter_donor_id: string;
  readonly gender: string;
  readonly submitter_specimen_id: string;
  readonly specimen_type: string;
  readonly tumour_normal_designation: string;
  readonly submitter_sample_id: string;
  readonly sample_type: string;
}

export type RegistrationRecordFields = keyof SubmittedRegistrationRecord;

type x = { [key in keyof SubmittedRegistrationRecord]: keyof CreateRegistrationRecord };

export const RegistrationToCreateRegistrationFieldsMap: x = {
  program_id: "programId",
  submitter_donor_id: "donorSubmitterId",
  gender: "gender",
  submitter_specimen_id: "specimenSubmitterId",
  specimen_type: "specimenType",
  tumour_normal_designation: "tumourNormalDesignation",
  submitter_sample_id: "sampleSubmitterId",
  sample_type: "sampleType"
};

export enum FieldsEnum {
  program_id = "program_id",
  submitter_donor_id = "submitter_donor_id",
  gender = "gender",
  submitter_specimen_id = "submitter_specimen_id",
  specimen_type = "specimen_type",
  tumour_normal_designation = "tumour_normal_designation",
  submitter_sample_id = "submitter_sample_id",
  sample_type = "sample_type"
}

export type SubmissionValidationError = {
  type: DataValidationErrors | SchemaValidationErrorTypes;
  fieldName: string;
  info: object;
  index: number;
};

export enum DataValidationErrors {
  MUTATING_EXISTING_DATA = "MUTATING_EXISTING_DATA",
  SAMPLE_BELONGS_TO_OTHER_SPECIMEN = "SAMPLE_BELONGS_TO_OTHER_SPECIMEN",
  SPECIMEN_BELONGS_TO_OTHER_DONOR = "SPECIMEN_BELONGS_TO_OTHER_DONOR",
  NEW_SPECIMEN_ATTR_CONFLICT = "NEW_SPECIMEN_ATTR_CONFLICT",
  NEW_SAMPLE_ATTR_CONFLICT = "NEW_SAMPLE_ATTR_CONFLICT",
  NEW_DONOR_CONFLICT = "NEW_DONOR_CONFLICT",
  INVALID_PROGRAM_ID = "INVALID_PROGRAM_ID",
  NEW_SPECIMEN_ID_CONFLICT = "NEW_SPECIMEN_ID_CONFLICT",
  NEW_SAMPLE_ID_CONFLICT = "NEW_SAMPLE_ID_CONFLICT"
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
  readonly programId: string;
}

export interface CreateRegistrationCommand {
  // we define the records as arbitrary key value pairs to be validated by the schema
  // before we put them in a CreateRegistrationRecord, in case a column is missing so we let dictionary handle error collection.
  records: ReadonlyArray<Readonly<{ [key: string]: string }>>;
  readonly creator: string;
  readonly programId: string;
  readonly batchName: string;
}

export interface CreateRegistrationResult {
  readonly registration: DeepReadonly<ActiveRegistration> | undefined;
  readonly successful: boolean;
  errors: DeepReadonly<SubmissionValidationError[]>;
}

export interface ValidationResult {
  errors: DeepReadonly<SubmissionValidationError[]>;
}

export interface SubmissionCommand {
  records: ReadonlyArray<Readonly<{ [key: string]: string }>>;
  readonly programId: string;
  readonly clinicalType: string;
}

export interface SubmissionMultipleCommand {
  newClinicalEntities: Readonly<{ [clinicalType: string]: NewClinicalEntity }>;
  readonly programId: string;
}

export interface CreateSubmissionResult {
  readonly submission: Object | undefined;
  readonly successful: boolean;
  errors: DeepReadonly<{ [clinicalType: string]: SubmissionValidationError[] }>;
}

export interface NewClinicalEntity {
  batchName: String;
  creator: String;
  records: ReadonlyArray<Readonly<{ [key: string]: string }>>;
}

export interface SavedClinicalEntity extends NewClinicalEntity {
  dataErrors: [];
  stats: {
    new: Number[];
    noUpdate: Number[];
    updated: Number[];
    errorsFound: Number[];
  };
}

export enum SUBMISSION_STATE {
  PROCESSING = "PROCESSING",
  OPEN = "OPEN",
  VALID = "VALID",
  INVALID = "INVALID",
  PENDING_APPROVAL = "PENDING_APPROVAL"
}

export interface ActiveSubmission {
  programId: String;
  state: SUBMISSION_STATE;
  hashVersion: String;
  clinicalEntities: { [clinicalType: string]: SavedClinicalEntity };
}
