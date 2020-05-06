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

export type ClinicalFields =
  | DonorFieldsEnum
  | SpecimenFieldsEnum
  | FollowupFieldsEnum
  | PrimaryDiagnosisFieldsEnum
  | TreatmentFieldsEnum
  | TherapyRxNormFields
  | RadiationFieldsEnum
  | CommonTherapyFields;

export type ClinicalTherapyType =
  | ClinicalEntitySchemaNames.CHEMOTHERAPY
  | ClinicalEntitySchemaNames.RADIATION
  | ClinicalEntitySchemaNames.HORMONE_THERAPY;

export const ClinicalTherapySchemaNames: ClinicalTherapyType[] = [
  ClinicalEntitySchemaNames.CHEMOTHERAPY,
  ClinicalEntitySchemaNames.HORMONE_THERAPY,
  ClinicalEntitySchemaNames.RADIATION,
];

export enum DonorFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  vital_status = 'vital_status',
  survival_time = 'survival_time',
  cause_of_death = 'cause_of_death',
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
  central_pathology_confirmed = 'central_pathology_confirmed',
  tumour_histological_type = 'tumour_histological_type',
}

export enum PrimaryDiagnosisFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  cancer_type_code = 'cancer_type_code',
  age_at_diagnosis = 'age_at_diagnosis',
}

export enum TreatmentFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  submitter_treatment_id = 'submitter_treatment_id',
  treatment_type = 'treatment_type',
}

export enum TherapyRxNormFields {
  drug_name = 'drug_name',
  drug_rxnormid = 'drug_rxnormcui',
}

export enum CommonTherapyFields {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  submitter_treatment_id = 'submitter_treatment_id',
}

export enum RadiationFieldsEnum {
  radiation_therapy_modality = 'radiation_therapy_modality',
}

export enum FollowupFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  submitter_follow_up_id = 'submitter_follow_up_id',
}

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
    CommonTherapyFields.submitter_donor_id,
    CommonTherapyFields.submitter_treatment_id,
    TherapyRxNormFields.drug_rxnormid,
  ],
  [ClinicalEntitySchemaNames.RADIATION]: [
    CommonTherapyFields.submitter_donor_id,
    CommonTherapyFields.submitter_treatment_id,
    RadiationFieldsEnum.radiation_therapy_modality,
  ],
  [ClinicalEntitySchemaNames.HORMONE_THERAPY]: [
    CommonTherapyFields.submitter_donor_id,
    CommonTherapyFields.submitter_treatment_id,
    TherapyRxNormFields.drug_rxnormid,
  ],
};
