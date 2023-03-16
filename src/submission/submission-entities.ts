/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { DeepReadonly } from 'deep-freeze';
import { entities as dictionaryEntities } from '@overturebio-stack/lectern-client';
import {
  ClinicalEntitySchemaNames,
  DonorFieldsEnum,
  SpecimenFieldsEnum,
  PrimaryDiagnosisFieldsEnum,
  FollowupFieldsEnum,
  TreatmentFieldsEnum,
  TherapyRxNormFields,
  CommonTherapyFields,
  RadiationFieldsEnum,
  ClinicalTherapyType,
  ImmunotherapyFields,
  FamilyHistoryFieldsEnum,
  ExposureFieldsEnum,
  ComorbidityFieldsEnum,
  BiomarkerFieldsEnum,
} from '../common-model/entities';

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

export interface LegacyICGCImportRecord {
  project_code: string;
  submitted_donor_id: string;
  icgc_donor_id: string;
  donor_sex: string;
  submitted_specimen_id: string;
  specimen_type: string;
  icgc_specimen_id: string;
  icgc_sample_id: string;
  submitted_sample_id: string;
  library_strategy: string;
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

type SubmittedRegistrationToCreateRegistrationMapType = {
  [key in keyof SubmittedRegistrationRecord]: keyof CreateRegistrationRecord;
};
export const RegistrationToCreateRegistrationFieldsMap: SubmittedRegistrationToCreateRegistrationMapType = {
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
  type: DataValidationErrors | dictionaryEntities.SchemaValidationErrorTypes;
  fieldName: string;
  info: any;
  index: number;
  message: string;
};

export type SubmissionValidationOutput = {
  errors: Array<SubmissionValidationError>;
  warnings?: Array<SubmissionValidationError>;
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
  code: SubmissionBatchErrorTypes | dictionaryEntities.SchemaValidationErrorTypes;
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
  DELETING_THERAPY = 'DELETING_THERAPY',
  MUTATING_EXISTING_DATA = 'MUTATING_EXISTING_DATA',
  SAMPLE_BELONGS_TO_OTHER_SPECIMEN = 'SAMPLE_BELONGS_TO_OTHER_SPECIMEN',
  SPECIMEN_BELONGS_TO_OTHER_DONOR = 'SPECIMEN_BELONGS_TO_OTHER_DONOR',
  NEW_SPECIMEN_ATTR_CONFLICT = 'NEW_SPECIMEN_ATTR_CONFLICT',
  NEW_SAMPLE_ATTR_CONFLICT = 'NEW_SAMPLE_ATTR_CONFLICT',
  NEW_DONOR_CONFLICT = 'NEW_DONOR_CONFLICT',
  INVALID_PROGRAM_ID = 'INVALID_PROGRAM_ID',
  INVALID_SUBMITTER_DONOR_ID = 'INVALID_SUBMITTER_DONOR_ID',
  NEW_SPECIMEN_ID_CONFLICT = 'NEW_SPECIMEN_ID_CONFLICT',
  NEW_SAMPLE_ID_CONFLICT = 'NEW_SAMPLE_ID_CONFLICT',
  ID_NOT_REGISTERED = 'ID_NOT_REGISTERED',
  CONFLICTING_TIME_INTERVAL = 'CONFLICTING_TIME_INTERVAL',
  FOLLOW_UP_CONFLICING_INTERVAL = 'FOLLOW_UP_CONFLICING_INTERVAL',
  TREATMENT_TIME_CONFLICT = 'TREATMENT_TIME_CONFLICT',
  NOT_ENOUGH_INFO_TO_VALIDATE = 'NOT_ENOUGH_INFO_TO_VALIDATE',
  RELATED_ENTITY_MISSING_OR_CONFLICTING = 'RELATED_ENTITY_MISSING_OR_CONFLICTING',
  FOUND_IDENTICAL_IDS = 'FOUND_IDENTICAL_IDS',
  MISSING_THERAPY_DATA = 'MISSING_THERAPY_DATA',
  INVALID_THERAPY_DATA = 'INVALID_THERAPY_DATA',
  INCOMPATIBLE_PARENT_TREATMENT_TYPE = 'INCOMPATIBLE_PARENT_TREATMENT_TYPE',
  TREATMENT_ID_NOT_FOUND = 'TREATMENT_ID_NOT_FOUND',
  CLINICAL_ENTITY_BELONGS_TO_OTHER_DONOR = 'CLINICAL_ENTITY_BELONGS_TO_OTHER_DONOR',
  MISSING_VARIABLE_REQUIREMENT = 'MISSING_VARIABLE_REQUIREMENT',
  FORBIDDEN_PROVIDED_VARIABLE_REQUIREMENT = 'FORBIDDEN_PROVIDED_VARIABLE_REQUIREMENT',
  THERAPY_RXNORM_RXCUI_NOT_FOUND = 'THERAPY_RXCUI_NOT_FOUND',
  THERAPY_RXNORM_DRUG_NAME_INVALID = 'THERAPY_RXNORM_DRUG_NAME_INVALID',
  THERAPY_MISSING_RXNORM_FIELDS = 'THERAPY_MISSING_RXNORM_FIELDS',
  TNM_STAGING_FIELDS_MISSING = 'TNM_STAGING_FIELDS_MISSING',
  TREATMENT_DONOR_TIME_CONFLICT = 'TREATMENT_DONOR_TIME_CONFLICT',
  FOLLOW_UP_DONOR_TIME_CONFLICT = 'FOLLOW_UP_DONOR_TIME_CONFLICT',
  DUPLICATE_SUBMITTER_SPECIMEN_ID_IN_SURGERY = 'DUPLICATE_SUBMITTER_SPECIMEN_ID_IN_SURGERY',
  SURGERY_TYPES_NOT_EQUAL = 'SURGERY_TYPES_NOT_EQUAL',
  DUPLICATE_SURGERY_WHEN_SPECIMEN_NOT_SUBMITTED = 'DUPLICATE_SURGERY_WHEN_SPECIMEN_NOT_SUBMITTED',
  RADIATION_REFERENCE_ID_CONFLICT = 'RADIATION_REFERENCE_ID_CONFLICT',
  RADIATION_THERAPY_TREATMENT_CONFLICT = 'RADIATION_THERAPY_TREATMENT_CONFLICT',
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
  records: ReadonlyArray<dictionaryEntities.DataRecord>;
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
  records: ReadonlyArray<dictionaryEntities.DataRecord>;
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
  records: ReadonlyArray<dictionaryEntities.DataRecord>;
  fieldNames?: ReadonlyArray<string>; // used if all records have common field names
}

export interface SavedClinicalEntity {
  batchName: string;
  creator: string;
  records: ReadonlyArray<Readonly<{ [key: string]: string }>>;
  createdAt: DeepReadonly<Date>;
  schemaErrors: DeepReadonly<SubmissionValidationError[]>;
  dataErrors: SubmissionValidationError[];
  dataWarnings: SubmissionValidationError[];
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
  [fieldName: string]: string | number | string[];
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

export interface RecordValidationResult {
  status: ModificationType;
  index: number;
  errors?: SubmissionValidationError[] | SubmissionValidationUpdate[];
  updates: SubmissionValidationUpdate[];
  warnings: SubmissionValidationError[];
}

export enum ModificationType {
  ERRORSFOUND = 'errorsFound',
  NEW = 'new',
  UPDATED = 'updated',
  NOUPDATE = 'noUpdate',
}

export type ClinicalTypeValidateResult = {
  [clinicalType: string]: Pick<
    SavedClinicalEntity,
    'dataErrors' | 'dataWarnings' | 'dataUpdates' | 'stats'
  >;
};

// batchNameRegex are arrays, so we can just add new file name regex when needed
// also we should check file extensions at api level for each file type upload function
// TODO: remove special case for surgery type
export const BatchNameRegex: Record<ClinicalEntitySchemaNames, RegExp[]> = {
  [ClinicalEntitySchemaNames.REGISTRATION]: [/^sample_registration.*\.tsv$/i],
  [ClinicalEntitySchemaNames.DONOR]: [/^donor.*\.tsv$/i],
  [ClinicalEntitySchemaNames.SPECIMEN]: [/^specimen.*\.tsv$/i],
  [ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]: [/^primary_diagnosis.*\.tsv$/i],
  [ClinicalEntitySchemaNames.FAMILY_HISTORY]: [/^family_history.*\.tsv$/i],
  [ClinicalEntitySchemaNames.FOLLOW_UP]: [/^follow_up.*\.tsv$/i],
  [ClinicalEntitySchemaNames.TREATMENT]: [/^treatment.*\.tsv$/i],
  [ClinicalEntitySchemaNames.CHEMOTHERAPY]: [/^chemotherapy.*\.tsv$/i],
  [ClinicalEntitySchemaNames.RADIATION]: [/^radiation.*\.tsv$/i],
  [ClinicalEntitySchemaNames.HORMONE_THERAPY]: [/^hormone_therapy.*\.tsv$/i],
  [ClinicalEntitySchemaNames.IMMUNOTHERAPY]: [/^immunotherapy.*\.tsv$/i],
  [ClinicalEntitySchemaNames.SURGERY]: [/^surgery.*\.tsv$/i],
  [ClinicalEntitySchemaNames.EXPOSURE]: [/^exposure.*\.tsv$/i],
  [ClinicalEntitySchemaNames.COMORBIDITY]: [/^comorbidity.*\.tsv$/i],
  [ClinicalEntitySchemaNames.BIOMARKER]: [/^biomarker.*\.tsv$/i],
};

export interface ClinicalSubmissionRecordsByDonorIdMap {
  [donoSubmitterId: string]: SubmittedClinicalRecordsMap;
}

export interface SubmittedClinicalRecordsMap {
  [type: string]: SubmittedClinicalRecord[];
}

export type IdToIndexMap = { [k: string]: number[] };

// TODO: remove special case for surgery type
export const ClinicalEntityToEnumFieldsMap: Record<ClinicalEntitySchemaNames, string[]> = {
  [ClinicalEntitySchemaNames.REGISTRATION]: Object.values(SampleRegistrationFieldsEnum),
  [ClinicalEntitySchemaNames.DONOR]: Object.values(DonorFieldsEnum),
  [ClinicalEntitySchemaNames.SPECIMEN]: Object.values(SpecimenFieldsEnum),
  [ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]: Object.values(PrimaryDiagnosisFieldsEnum),
  [ClinicalEntitySchemaNames.FAMILY_HISTORY]: Object.values(FamilyHistoryFieldsEnum),
  [ClinicalEntitySchemaNames.EXPOSURE]: Object.values(ExposureFieldsEnum),
  [ClinicalEntitySchemaNames.COMORBIDITY]: Object.values(ComorbidityFieldsEnum),
  [ClinicalEntitySchemaNames.BIOMARKER]: Object.values(BiomarkerFieldsEnum),
  [ClinicalEntitySchemaNames.FOLLOW_UP]: Object.values(FollowupFieldsEnum),
  [ClinicalEntitySchemaNames.TREATMENT]: Object.values(TreatmentFieldsEnum),
  [ClinicalEntitySchemaNames.CHEMOTHERAPY]: (Object.values(TherapyRxNormFields) as string[]).concat(
    Object.values(CommonTherapyFields),
  ),
  [ClinicalEntitySchemaNames.RADIATION]: (Object.values(RadiationFieldsEnum) as string[]).concat(
    Object.values(CommonTherapyFields),
  ),
  [ClinicalEntitySchemaNames.HORMONE_THERAPY]: (Object.values(
    TherapyRxNormFields,
  ) as string[]).concat(Object.values(CommonTherapyFields)),
  [ClinicalEntitySchemaNames.IMMUNOTHERAPY]: (Object.values(TherapyRxNormFields) as string[])
    .concat(Object.values(CommonTherapyFields))
    .concat(Object.values(ImmunotherapyFields) as string[]),
  [ClinicalEntitySchemaNames.SURGERY]: Object.values(CommonTherapyFields) as string[],
};

export const TreatmentTypeValuesMappedByTherapy: Record<ClinicalTherapyType, string> = {
  [ClinicalEntitySchemaNames.CHEMOTHERAPY]: 'Chemotherapy',
  [ClinicalEntitySchemaNames.RADIATION]: 'Radiation therapy',
  [ClinicalEntitySchemaNames.HORMONE_THERAPY]: 'Hormonal therapy',
  [ClinicalEntitySchemaNames.IMMUNOTHERAPY]: 'Immunotherapy',
  [ClinicalEntitySchemaNames.SURGERY]: 'Surgery',
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
