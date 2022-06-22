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

// this is temporary to keep code compiling until surgery is ready in dictionary, to be removed in favor of
// the surgery in ClinicalEntitySchemaNames
export const SURGERY_SCHEMA_NAME = 'surgery';

export enum ClinicalEntitySchemaNames {
  REGISTRATION = 'sample_registration',
  DONOR = 'donor',
  SPECIMEN = 'specimen',
  PRIMARY_DIAGNOSIS = 'primary_diagnosis',
  FAMILY_HISTORY = 'family_history',
  TREATMENT = 'treatment',
  CHEMOTHERAPY = 'chemotherapy',
  IMMUNOTHERAPY = 'immunotherapy',
  SURGERY = 'surgery',
  RADIATION = 'radiation',
  FOLLOW_UP = 'follow_up',
  HORMONE_THERAPY = 'hormone_therapy',
  EXPOSURE = 'exposure',
  COMORBIDITY = 'comorbidity',
  BIOMARKER = 'biomarker',
}

export type EntityAlias =
  | 'donor'
  | 'sampleRegistration'
  | 'specimens'
  | 'primaryDiagnoses'
  | 'familyHistory'
  | 'treatment'
  | 'chemotherapy'
  | 'immunotherapy'
  | 'surgery'
  | 'radiation'
  | 'followUps'
  | 'hormoneTherapy'
  | 'exposure'
  | 'comorbidity'
  | 'biomarker'
  | ClinicalEntitySchemaNames.CHEMOTHERAPY
  | ClinicalEntitySchemaNames.RADIATION
  | ClinicalEntitySchemaNames.HORMONE_THERAPY
  | ClinicalEntitySchemaNames.IMMUNOTHERAPY
  | ClinicalEntitySchemaNames.SURGERY;

export const aliasEntityNames: Record<ClinicalEntitySchemaNames, EntityAlias> = {
  donor: 'donor',
  sample_registration: 'sampleRegistration',
  specimen: 'specimens',
  primary_diagnosis: 'primaryDiagnoses',
  family_history: 'familyHistory',
  treatment: 'treatment',
  chemotherapy: 'chemotherapy',
  immunotherapy: 'immunotherapy',
  surgery: 'surgery',
  radiation: 'radiation',
  follow_up: 'followUps',
  hormone_therapy: 'hormoneTherapy',
  exposure: 'exposure',
  comorbidity: 'comorbidity',
  biomarker: 'biomarker',
};

export type ClinicalFields =
  | DonorFieldsEnum
  | SpecimenFieldsEnum
  | FollowupFieldsEnum
  | PrimaryDiagnosisFieldsEnum
  | FamilyHistoryFieldsEnum
  | TreatmentFieldsEnum
  | TherapyRxNormFields
  | RadiationFieldsEnum
  | SurgeryFieldsEnum
  | CommonTherapyFields
  | ExposureFieldsEnum
  | ComorbidityFieldsEnum
  | BiomarkerFieldsEnum;

export type ClinicalTherapyType =
  | ClinicalEntitySchemaNames.CHEMOTHERAPY
  | ClinicalEntitySchemaNames.RADIATION
  | ClinicalEntitySchemaNames.HORMONE_THERAPY
  | ClinicalEntitySchemaNames.IMMUNOTHERAPY
  | ClinicalEntitySchemaNames.SURGERY;

export const ClinicalTherapySchemaNames: ClinicalTherapyType[] = [
  ClinicalEntitySchemaNames.CHEMOTHERAPY,
  ClinicalEntitySchemaNames.HORMONE_THERAPY,
  ClinicalEntitySchemaNames.RADIATION,
  ClinicalEntitySchemaNames.IMMUNOTHERAPY,
  ClinicalEntitySchemaNames.SURGERY,
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
  reference_pathology_confirmed = 'reference_pathology_confirmed',
  tumour_histological_type = 'tumour_histological_type',
  submitter_primary_diagnosis_id = 'submitter_primary_diagnosis_id',
}

export enum PrimaryDiagnosisFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  submitter_primary_diagnosis_id = 'submitter_primary_diagnosis_id',
  cancer_type_code = 'cancer_type_code',
  age_at_diagnosis = 'age_at_diagnosis',
  clinical_tumour_staging_system = 'clinical_tumour_staging_system',
  clinical_stage_group = 'clinical_stage_group',
  clinical_t_category = 'clinical_t_category',
  clinical_n_category = 'clinical_n_category',
  clinical_m_category = 'clinical_m_category',
}

export enum FamilyHistoryFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  family_relative_id = 'family_relative_id',
}

export enum ComorbidityFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  comorbidity_type_code = 'comorbidity_type_code',
}

export enum BiomarkerFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  submitter_specimen_id = 'submitter_specimen_id',
  submitter_primary_diagnosis_id = 'submitter_primary_diagnosis_id',
  submitter_treatment_id = 'submitter_treatment_id',
  submitter_follow_up_id = 'submitter_follow_up_id',
  test_interval = 'test_interval',
}

export enum TreatmentFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  submitter_treatment_id = 'submitter_treatment_id',
  treatment_type = 'treatment_type',
  submitter_primary_diagnosis_id = 'submitter_primary_diagnosis_id',
  treatment_start_interval = 'treatment_start_interval',
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

export enum SurgeryFieldsEnum {
  submitter_specimen_id = 'submitter_specimen_id',
  surgery_type = 'surgery_type',
}

export enum RadiationFieldsEnum {
  radiation_therapy_modality = 'radiation_therapy_modality',
}

export enum ImmunotherapyFields {
  immunotherapy_type = 'immunotherapy_type',
}

export enum FollowupFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
  submitter_follow_up_id = 'submitter_follow_up_id',
  submitter_primary_diagnosis_id = 'submitter_primary_diagnosis_id',
  submitter_treatment_id = 'submitter_treatment_id',
  interval_of_followup = 'interval_of_followup',
}

export enum ExposureFieldsEnum {
  program_id = 'program_id',
  submitter_donor_id = 'submitter_donor_id',
}

// This needed to be added to differentiate between multiple or single fields for identifying
type TypeEntitySchemaNameToIndenfiterType = {
  [ClinicalEntitySchemaNames.DONOR]: ClinicalFields;
  [ClinicalEntitySchemaNames.SPECIMEN]: ClinicalFields;
  [ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]: ClinicalFields;
  [ClinicalEntitySchemaNames.EXPOSURE]: ClinicalFields;
  [ClinicalEntitySchemaNames.BIOMARKER]: ClinicalFields[];
  [ClinicalEntitySchemaNames.FAMILY_HISTORY]: ClinicalFields[];
  [ClinicalEntitySchemaNames.FOLLOW_UP]: ClinicalFields;
  [ClinicalEntitySchemaNames.TREATMENT]: ClinicalFields;
  [ClinicalEntitySchemaNames.CHEMOTHERAPY]: ClinicalFields[];
  [ClinicalEntitySchemaNames.IMMUNOTHERAPY]: ClinicalFields[];
  [SURGERY_SCHEMA_NAME]: ClinicalFields[];
  [ClinicalEntitySchemaNames.RADIATION]: ClinicalFields[];
  [ClinicalEntitySchemaNames.HORMONE_THERAPY]: ClinicalFields[];
  [ClinicalEntitySchemaNames.COMORBIDITY]: ClinicalFields[];
};

export const ClinicalUniqueIdentifier: TypeEntitySchemaNameToIndenfiterType = {
  [ClinicalEntitySchemaNames.DONOR]: DonorFieldsEnum.submitter_donor_id,
  [ClinicalEntitySchemaNames.SPECIMEN]: SpecimenFieldsEnum.submitter_specimen_id,
  [ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]:
    PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id,
  [ClinicalEntitySchemaNames.EXPOSURE]: ExposureFieldsEnum.submitter_donor_id,
  // Family history is an independent entity, but it must be uniquely identified by 2 ids,
  // because family_relative_id field is NOT unique within a program, it's only unique within a donor.
  [ClinicalEntitySchemaNames.FAMILY_HISTORY]: [
    FamilyHistoryFieldsEnum.submitter_donor_id,
    FamilyHistoryFieldsEnum.family_relative_id,
  ],
  [ClinicalEntitySchemaNames.BIOMARKER]: [
    BiomarkerFieldsEnum.submitter_donor_id,
    BiomarkerFieldsEnum.submitter_specimen_id,
    BiomarkerFieldsEnum.submitter_primary_diagnosis_id,
    BiomarkerFieldsEnum.submitter_treatment_id,
    BiomarkerFieldsEnum.submitter_follow_up_id,
    BiomarkerFieldsEnum.test_interval,
  ],
  [ClinicalEntitySchemaNames.FOLLOW_UP]: FollowupFieldsEnum.submitter_follow_up_id,
  [ClinicalEntitySchemaNames.TREATMENT]: TreatmentFieldsEnum.submitter_treatment_id,
  [ClinicalEntitySchemaNames.CHEMOTHERAPY]: [
    CommonTherapyFields.submitter_donor_id,
    CommonTherapyFields.submitter_treatment_id,
    TherapyRxNormFields.drug_rxnormid,
  ],
  [ClinicalEntitySchemaNames.IMMUNOTHERAPY]: [
    CommonTherapyFields.submitter_donor_id,
    CommonTherapyFields.submitter_treatment_id,
    TherapyRxNormFields.drug_rxnormid,
  ],
  [SURGERY_SCHEMA_NAME]: [
    CommonTherapyFields.submitter_donor_id,
    CommonTherapyFields.submitter_treatment_id,
    SpecimenFieldsEnum.submitter_specimen_id,
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
  [ClinicalEntitySchemaNames.COMORBIDITY]: [
    ComorbidityFieldsEnum.submitter_donor_id,
    ComorbidityFieldsEnum.comorbidity_type_code,
  ],
};
