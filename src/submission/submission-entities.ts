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
  readonly schemaVersion: string;
}

export interface SubmittedRegistrationRecord {
  readonly program_id: string;
  readonly submitter_donor_id: string;
  readonly gender: string;
  readonly submitter_specimen_id: string;
  readonly specimen_tissue_source: string;
  readonly tumour_normal_designation: string;
  readonly specimen_type: string;
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
  specimen_type: 'specimenType',
  submitter_sample_id: 'sampleSubmitterId',
  sample_type: 'sampleType',
};

export type SubmissionValidationError = {
  type: DataValidationErrors | SchemaValidationErrorTypes;
  fieldName: string;
  info: any;
  index: number;
  message: string;
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
  message: string;
  batchNames: string[];
  code: SubmissionBatchErrorTypes | SchemaValidationErrorTypes;
};

export enum SubmissionBatchErrorTypes {
  TSV_PARSING_FAILED = 'TSV_PARSING_FAILED',
  INVALID_FILE_NAME = 'INVALID_FILE_NAME',
  MULTIPLE_TYPED_FILES = 'MULTIPLE_TYPED_FILES',
  UNRECOGNIZED_HEADER = 'UNRECOGNIZED_HEADER',
  MISSING_REQUIRED_HEADER = 'MISSING_REQUIRED_HEADER',
  INCORRECT_SECTION = 'INCORRECT_SECTION',
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
  FOUND_IDENTICAL_IDS = 'FOUND_IDENTICAL_IDS',
  MISSING_THERAPY_DATA = 'MISSING_THERAPY_DATA',
  INVALID_THERAPY_DATA = 'INVALID_THERAPY_DATA',
  INCOMPATIBLE_PARENT_TREATMENT_TYPE = 'INCOMPATIBLE_PARENT_TREATMENT_TYPE',
  TREATMENT_ID_NOT_FOUND = 'TREATMENT_ID_NOT_FOUND',
  CLINICAL_ENTITY_BELONGS_TO_OTHER_DONOR = 'CLINICAL_ENTITY_BELONGS_TO_OTHER_DONOR',
  MISSING_VARIABLE_REQUIREMENT = 'MISSING_VARIABLE_REQUIREMENT',
  FORBIDDEN_PROVIDED_VARIABLE_REQUIREMENT = 'FORBIDDEN_PROVIDED_VARIABLE_REQUIREMENT',
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
  readonly specimenType: string;
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
  fieldNames?: ReadonlyArray<string>; // used if all records have common field names
}

export interface CreateRegistrationResult {
  readonly registration: DeepReadonly<ActiveRegistration> | undefined;
  readonly successful: boolean;
  errors?: DeepReadonly<SubmissionValidationError[]>; // these can be schema and validation
  batchErrors?: DeepReadonly<SubmissionBatchError[]>; // batch related errors only
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

export interface RevalidateClinicalSubmissionCommand {
  readonly programId: string;
  readonly migrationId: string;
}

export interface ClinicalSubmissionModifierCommand {
  readonly programId: string;
  readonly versionId: string;
  readonly updater: string;
}

export interface CreateSubmissionResult {
  readonly submission: DeepReadonly<ActiveClinicalSubmission> | undefined;
  readonly successful: boolean;
  batchErrors: DeepReadonly<SubmissionBatchError[]>;
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
  schemaErrors: DeepReadonly<SubmissionValidationError[]>;
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
  INVALID_BY_MIGRATION = 'INVALID_BY_MIGRATION',
  INVALID = 'INVALID',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
}

export interface ActiveClinicalSubmission {
  _id?: string;
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

/**
 * Those field enums are not all inclusive, they only contain fields used
 * in validation in code, we don't need to list all fields unless necessary
 */
export enum SampleRegistrationFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  gender = 'gender',
  submitter_specimen_id = 'submitter_specimen_id',
  specimen_tissue_source = 'specimen_tissue_source',
  tumour_normal_designation = 'tumour_normal_designation',
  specimen_type = 'specimen_type',
  submitter_sample_id = 'submitter_sample_id',
  sample_type = 'sample_type',
}

export type ClinicalFields =
  | DonorFieldsEnum
  | SpecimenFieldsEnum
  | FollowupFieldsEnum
  | PrimaryDiagnosisFieldsEnum
  | TreatmentFieldsEnum
  | ChemotherapyFieldsEnum
  | RadiationFieldsEnum
  | HormoneTherapyFieldsEnum;

export enum DonorFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  vital_status = 'vital_status',
  survival_time = 'survival_time',
}
export enum SpecimenFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  submitter_specimen_id = 'submitter_specimen_id',
  specimen_acquisition_interval = 'specimen_acquisition_interval',
  pathological_tumour_staging_system = 'pathological_tumour_staging_system',
  pathological_t_category = 'pathological_t_category',
  pathological_n_category = 'pathological_n_category',
  pathological_m_category = 'pathological_m_category',
  pathological_stage_group = 'pathological_stage_group',
  tumour_grading_system = 'tumour_grading_system',
  tumour_grade = 'tumour_grade',
  percent_tumour_cells = 'percent_tumour_cells',
  percent_proliferating_cells = 'percent_proliferating_cells',
  percent_stromal_cells = 'percent_stromal_cells',
  percent_necrosis = 'percent_necrosis',
  percent_inflammatory_tissue = 'percent_inflammatory_tissue',
}
export enum PrimaryDiagnosisFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
}
export enum TreatmentFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  submitter_treatment_id = 'submitter_treatment_id',
  treatment_type = 'treatment_type',
}
export enum ChemotherapyFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  submitter_treatment_id = 'submitter_treatment_id',
  chemotherapy_drug_name = 'chemotherapy_drug_name',
}
export enum HormoneTherapyFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  submitter_treatment_id = 'submitter_treatment_id',
  hormone_therapy_drug_name = 'hormone_therapy_drug_name',
}
export enum RadiationFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  submitter_treatment_id = 'submitter_treatment_id',
  radiation_therapy_modality = 'radiation_therapy_modality',
}
export enum FollowupFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  submitter_follow_up_id = 'submitter_follow_up_id',
}

export interface RecordValidationResult {
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

export enum ClinicalEntitySchemaNames {
  REGISTRATION = 'sample_registration',
  DONOR = 'donor',
  SPECIMEN = 'specimen',
  PRIMARY_DIAGNOSIS = 'primary_diagnosis',
  TREATMENT = 'treatment',
  CHEMOTHERAPY = 'chemotherapy',
  RADIATION = 'radiation',
  FOLLOW_UP = 'follow_up',
  HORMONE_THERAPY = 'hormone_therapy',
}

export type ClinicalTherapyType =
  | ClinicalEntitySchemaNames.CHEMOTHERAPY
  | ClinicalEntitySchemaNames.RADIATION
  | ClinicalEntitySchemaNames.HORMONE_THERAPY;

export const ClinicalTherapySchemaNames: ClinicalTherapyType[] = [
  ClinicalEntitySchemaNames.CHEMOTHERAPY,
  ClinicalEntitySchemaNames.HORMONE_THERAPY,
  ClinicalEntitySchemaNames.RADIATION,
];

// batchNameRegex are arrays, so we can just add new file name regex when needed
// also we should check file extensions at api level for each file type upload function
export const BatchNameRegex: Record<ClinicalEntitySchemaNames, RegExp[]> = {
  [ClinicalEntitySchemaNames.REGISTRATION]: [/^sample_registration.*\.tsv$/],
  [ClinicalEntitySchemaNames.DONOR]: [/^donor.*\.tsv$/],
  [ClinicalEntitySchemaNames.SPECIMEN]: [/^specimen.*\.tsv$/],
  [ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]: [/^primary_diagnosis.*\.tsv$/],
  [ClinicalEntitySchemaNames.FOLLOW_UP]: [/^follow_up.*\.tsv$/],
  [ClinicalEntitySchemaNames.TREATMENT]: [/^treatment.*\.tsv$/],
  [ClinicalEntitySchemaNames.CHEMOTHERAPY]: [/^chemotherapy.*\.tsv$/],
  [ClinicalEntitySchemaNames.RADIATION]: [/^radiation.*\.tsv$/],
  [ClinicalEntitySchemaNames.HORMONE_THERAPY]: [/^hormone_therapy.*\.tsv$/],
};

// This needed to be added to differentiate between multiple or single fields for identifying
type TypeEntitySchemaNameToIndenfiterType = {
  [ClinicalEntitySchemaNames.DONOR]: ClinicalFields;
  [ClinicalEntitySchemaNames.SPECIMEN]: ClinicalFields;
  [ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]: ClinicalFields;
  [ClinicalEntitySchemaNames.FOLLOW_UP]: ClinicalFields;
  [ClinicalEntitySchemaNames.TREATMENT]: ClinicalFields;
  [ClinicalEntitySchemaNames.CHEMOTHERAPY]: ClinicalFields[];
  [ClinicalEntitySchemaNames.RADIATION]: ClinicalFields[];
  [ClinicalEntitySchemaNames.HORMONE_THERAPY]: ClinicalFields[];
};

export const ClinicalUniqueIdentifier: TypeEntitySchemaNameToIndenfiterType = {
  [ClinicalEntitySchemaNames.DONOR]: DonorFieldsEnum.submitter_donor_id,
  [ClinicalEntitySchemaNames.SPECIMEN]: SpecimenFieldsEnum.submitter_specimen_id,
  [ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]: PrimaryDiagnosisFieldsEnum.submitter_donor_id,
  [ClinicalEntitySchemaNames.FOLLOW_UP]: FollowupFieldsEnum.submitter_follow_up_id,
  [ClinicalEntitySchemaNames.TREATMENT]: TreatmentFieldsEnum.submitter_treatment_id,
  [ClinicalEntitySchemaNames.CHEMOTHERAPY]: [
    ChemotherapyFieldsEnum.submitter_donor_id,
    ChemotherapyFieldsEnum.submitter_treatment_id,
    ChemotherapyFieldsEnum.chemotherapy_drug_name,
  ],
  [ClinicalEntitySchemaNames.RADIATION]: [
    RadiationFieldsEnum.submitter_donor_id,
    RadiationFieldsEnum.submitter_treatment_id,
    RadiationFieldsEnum.radiation_therapy_modality,
  ],
  [ClinicalEntitySchemaNames.HORMONE_THERAPY]: [
    HormoneTherapyFieldsEnum.submitter_donor_id,
    HormoneTherapyFieldsEnum.submitter_treatment_id,
    HormoneTherapyFieldsEnum.hormone_therapy_drug_name,
  ],
};

export interface ClinicalSubmissionRecordsByDonorIdMap {
  [donoSubmitterId: string]: SubmittedClinicalRecordsMap;
}

export interface SubmittedClinicalRecordsMap {
  [type: string]: SubmittedClinicalRecord[];
}

export const ClinicalEntityToEnumFieldsMap: Record<ClinicalEntitySchemaNames, string[]> = {
  [ClinicalEntitySchemaNames.REGISTRATION]: Object.values(SampleRegistrationFieldsEnum),
  [ClinicalEntitySchemaNames.DONOR]: Object.values(DonorFieldsEnum),
  [ClinicalEntitySchemaNames.SPECIMEN]: Object.values(SpecimenFieldsEnum),
  [ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]: Object.values(PrimaryDiagnosisFieldsEnum),
  [ClinicalEntitySchemaNames.FOLLOW_UP]: Object.values(FollowupFieldsEnum),
  [ClinicalEntitySchemaNames.TREATMENT]: Object.values(TreatmentFieldsEnum),
  [ClinicalEntitySchemaNames.CHEMOTHERAPY]: Object.values(ChemotherapyFieldsEnum),
  [ClinicalEntitySchemaNames.RADIATION]: Object.values(RadiationFieldsEnum),
  [ClinicalEntitySchemaNames.HORMONE_THERAPY]: Object.values(HormoneTherapyFieldsEnum),
};

export const TreatmentTypeValuesMappedByTherapy: Record<ClinicalTherapyType, string[]> = {
  [ClinicalEntitySchemaNames.CHEMOTHERAPY]: [
    'Chemotherapy',
    'Combined chemo+immunotherapy',
    'Combined chemo+radiation therapy',
    'Combined chemo-radiotherapy and surgery',
  ],
  [ClinicalEntitySchemaNames.RADIATION]: [
    'Radiation therapy',
    'Combined chemo+radiation therapy',
    'Photodynamic therapy',
  ],
  [ClinicalEntitySchemaNames.HORMONE_THERAPY]: ['Hormonal therapy'],
};

export const DonorVitalStatusValues = { deceased: 'Deceased' };

export const ClinicalEntityKnownFieldCodeLists: { [k: string]: { [k: string]: string[] } } = {
  [ClinicalEntitySchemaNames.DONOR]: {
    [DonorFieldsEnum.vital_status]: Object.values(DonorVitalStatusValues).flat(),
  },
  [ClinicalEntitySchemaNames.TREATMENT]: {
    [TreatmentFieldsEnum.treatment_type]: Object.values(TreatmentTypeValuesMappedByTherapy).flat(),
  },
};
