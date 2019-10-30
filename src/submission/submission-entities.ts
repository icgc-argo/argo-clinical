import { DeepReadonly } from 'deep-freeze';
import { SchemaValidationErrorTypes } from '../lectern-client/schema-entities';

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
  readonly specimen_tissue_source: string;
  readonly tumour_normal_designation: string;
  readonly submitter_sample_id: string;
  readonly sample_type: string;
}

type x = { [key in keyof SubmittedRegistrationRecord]: keyof CreateRegistrationRecord };

export const RegistrationToCreateRegistrationFieldsMap: x = {
  program_id: 'programId',
  submitter_donor_id: 'donorSubmitterId',
  gender: 'gender',
  submitter_specimen_id: 'specimenSubmitterId',
  specimen_tissue_source: 'specimenTissueSource',
  tumour_normal_designation: 'tumourNormalDesignation',
  submitter_sample_id: 'sampleSubmitterId',
  sample_type: 'sampleType',
};

export enum FieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  gender = 'gender',
  submitter_specimen_id = 'submitter_specimen_id',
  specimen_tissue_source = 'specimen_tissue_source',
  tumour_normal_designation = 'tumour_normal_designation',
  submitter_sample_id = 'submitter_sample_id',
  sample_type = 'sample_type',
}

export type SubmissionValidationError = {
  type: DataValidationErrors | SchemaValidationErrorTypes;
  fieldName: string;
  info: object;
  index: number;
};

export type SubmissionValidationUpdate = {
  fieldName: string;
  info: {
    donorSubmitterId: string;
    newValue: string;
    oldValue: string;
  };
  index: number;
};

export type SubmissionBatchError = {
  msg: string;
  fileNames: string[];
  code: SubmissionBatchErrorTypes | SchemaValidationErrorTypes;
};

export enum SubmissionBatchErrorTypes {
  TSV_PARSING_FAILED = 'TSV_PARSING_FAILED',
  INVALID_FILE_NAME = 'INVALID_FILE_NAME',
  MULTIPLE_TYPED_FILES = 'MULTIPLE_TYPED_FILES',
}

export enum DataValidationErrors {
  MUTATING_EXISTING_DATA = 'MUTATING_EXISTING_DATA',
  SAMPLE_BELONGS_TO_OTHER_SPECIMEN = 'SAMPLE_BELONGS_TO_OTHER_SPECIMEN',
  SPECIMEN_BELONGS_TO_OTHER_DONOR = 'SPECIMEN_BELONGS_TO_OTHER_DONOR',
  NEW_SPECIMEN_ATTR_CONFLICT = 'NEW_SPECIMEN_ATTR_CONFLICT',
  NEW_SAMPLE_ATTR_CONFLICT = 'NEW_SAMPLE_ATTR_CONFLICT',
  NEW_DONOR_CONFLICT = 'NEW_DONOR_CONFLICT',
  INVALID_PROGRAM_ID = 'INVALID_PROGRAM_ID',
  NEW_SPECIMEN_ID_CONFLICT = 'NEW_SPECIMEN_ID_CONFLICT',
  NEW_SAMPLE_ID_CONFLICT = 'NEW_SAMPLE_ID_CONFLICT',
  ID_NOT_REGISTERED = 'ID_NOT_REGISTERED',
  CONFLICTING_TIME_INTERVAL = 'CONFLICTING_TIME_INTERVAL',
  NOT_ENOUGH_INFO_TO_VALIDATE = 'NOT_ENOUGH_INFO_TO_VALIDATE',
}

export type RegistrationStat = Array<{
  submitterId: string;
  rowNumbers: number[];
}>;

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
  readonly specimenTissueSource: string;
  readonly tumourNormalDesignation: string;
  readonly sampleSubmitterId: string;
  readonly sampleType: string;
}

export interface ActiveSubmissionIdentifier {
  readonly versionId: string;
  readonly programId: string;
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

export interface ClinicalSubmissionCommand {
  records: ReadonlyArray<Readonly<{ [key: string]: string }>>;
  readonly programId: string;
  readonly clinicalType: string;
}

export interface ClearSubmissionCommand {
  readonly programId: string;
  readonly versionId: string;
  readonly fileType: string;
  readonly updater: string;
}

export interface MultiClinicalSubmissionCommand {
  newClinicalData: ReadonlyArray<NewClinicalEntity>;
  readonly programId: string;
  readonly updater: string;
}

export interface ClinicalSubmissionModifierCommand {
  readonly programId: string;
  readonly versionId: string;
  readonly updater: string;
}

export interface CreateSubmissionResult {
  readonly submission: DeepReadonly<ActiveClinicalSubmission> | undefined;
  readonly successful: boolean;
  schemaErrors: DeepReadonly<{ [clinicalType: string]: SubmissionValidationError[] }>;
  fileErrors: DeepReadonly<SubmissionBatchError[]>;
}

export interface ValidateSubmissionResult {
  readonly submission: DeepReadonly<ActiveClinicalSubmission> | undefined;
  readonly successful: boolean;
}

export interface NewClinicalEntities {
  [clinicalType: string]: NewClinicalEntity;
}

export interface NewClinicalEntity {
  batchName: string;
  creator: string;
  records: ReadonlyArray<Readonly<{ [key: string]: string }>>;
  fieldNames?: ReadonlyArray<string>; // used if all records have common field names
}

export interface SavedClinicalEntity {
  batchName: string;
  creator: string;
  records: ReadonlyArray<Readonly<{ [key: string]: string }>>;
  createdAt: DeepReadonly<Date>;
  dataErrors: SubmissionValidationError[];
  dataUpdates: SubmissionValidationUpdate[];
  stats: {
    new: number[];
    noUpdate: number[];
    updated: number[];
    errorsFound: number[];
  };
}

export enum SUBMISSION_STATE {
  OPEN = 'OPEN',
  VALID = 'VALID',
  INVALID = 'INVALID',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
}

export interface ActiveClinicalSubmission {
  programId: string;
  state: SUBMISSION_STATE;
  version: string;
  clinicalEntities: ClinicalEntities;
  updatedBy: string;
  updatedAt?: Date; // this is currently set by db
}

export interface ClinicalEntities {
  [clinicalType: string]: SavedClinicalEntity;
}

// Generic submission record object
export interface SubmittedClinicalRecord {
  readonly submitter_donor_id: string;
  readonly index: number;
  [fieldName: string]: string | number;
}

export enum ClinicalInfoFieldsEnum {
  acquisition_interval = 'acquisition_interval',
  vital_status = 'vital_status',
  survival_time = 'survival_time',
}

export interface ValidatorResult {
  type: ModificationType;
  index: number;
  resultArray?: SubmissionValidationError[] | SubmissionValidationUpdate[];
}

export enum ModificationType {
  ERRORSFOUND = 'errorsFound',
  NEW = 'new',
  UPDATED = 'updated',
  NOUPDATE = 'noUpdate',
}

export type ClinicalTypeValidateResult = {
  [clinicalType: string]: Pick<SavedClinicalEntity, 'dataErrors' | 'dataUpdates' | 'stats'>;
};
