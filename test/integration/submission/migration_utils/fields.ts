/*
 * Copyright (c) 2023 The Ontario Institute for Cancer Research. All rights reserved
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

export const sampleRegistration = {
	PROGRAM_ID: 'program_id',
	SUBMITTER_DONOR_ID: 'submitter_donor_id',
	GENDER: 'gender',
	SUBMITTER_SPECIMEN_ID: 'submitter_specimen_id',
	SPECIMEN_TISSUE_SOURCE: 'specimen_tissue_source',
	TUMOUR_NORMAL_DESIGNATION: 'tumour_normal_designation',
	SPECIMEN_TYPE: 'specimen_type',
	SUBMITTED_SAMPLE_ID: 'submitter_sample_id',
	SAMPLE_TYPE: 'sample_type',
};
export const donor = {
	PROGRAM_ID: 'program_id',
	SUBMITTER_DONOR_ID: 'submitter_donor_id',
	VITAL_STATUS: 'vital_status',
	CAUSE_OF_DEATH: 'cause_of_death',
	SURVIVAL_TIME: 'survival_time',
	LOST_TO_FOLLOWUP_AFTER_CLINICAL_EVENT_ID: 'lost_to_followup_after_clinical_event_id',
};

export const primaryDiagnosis = {
	PROGRAM_ID: 'program_id',
	SUBMITTER_DONOR_ID: 'submitter_donor_id',
	AGE_AT_DIAGNOSIS: 'age_at_diagnosis',
	CANCER_TYPE_CODE: 'cancer_type_code',
	TUMOUR_STAGING_SYSTEM: 'clinical_tumour_staging_system',
	CLINICAL_STAGE_GROUP: 'clinical_stage_group',
	STAGE_SUFFIX: 'stage_suffix',
	CLINICAL_T_CATEGORY: 'clinical_t_category',
	CLINICAL_N_CATEGORY: 'clinical_n_category',
	CLINICAL_M_CATEGORY: 'clinical_m_category',
	NUMBER_LYMPH_NODES_EXAMINED: 'number_lymph_nodes_examined',
	PRESENTING_SYMPTOMS: 'presenting_symptoms',
	MENOPAUSE_STATUS: 'menopause_status',
};

export const specimen = {
	PROGRAM_ID: 'program_id',
	SUBMITTER_DONOR_ID: 'submitter_donor_id',
	SUBMITTER_SPECIMEN_ID: 'submitter_specimen_id',
	SPECIMEN_ACQUISITION_INTERVAL: 'specimen_acquisition_interval',
	SPECIMEN_ANATOMIC_LOCATION: 'specimen_anatomic_location',
	reference_pathology_confirmed: 'reference_pathology_confirmed',
	TUMOUR_HISTOLOGICAL_TYPE: 'tumour_histological_type',
	TUMOUR_GRADING_SYSTEM: 'tumour_grading_system',
	TUMOUR_GRADE: 'tumour_grade',
	PATHOLOGICAL_TUMOUR_STAGING_SYSTEM: 'pathological_tumour_staging_system',
	PATHOLOGICAL_STAGE_GROUP: 'pathological_stage_group',
	PATHOLOGICAL_T_CATEGORY: 'pathological_t_category',
	PATHOLOGICAL_N_CATEGORY: 'pathological_n_category',
	PATHOLOGICAL_M_CAREGORY: 'pathological_m_category',
	PERCENT_TUMOUR_CELLS: 'percent_tumour_cells',
	PERCENT_TUMOUR_CELLS_MEASUREMENT_METHOD: 'percent_tumour_cells_measurement_method',
	PERCENT_PROLIFERATING_CELLS: 'percent_proliferating_cells',
	PERCENT_INFLAMMATORY_TISSUE: 'percent_inflammatory_tissue',
	PERCENT_STROMAL_CELLS: 'percent_stromal_cells',
	PERCENT_NECROSIS: 'percent_necrosis',
};
export const followup = {
	PROGRAM_ID: 'program_id',
	SUBMITTER_DONOR_ID: 'submitter_donor_id',
	SUBMITTER_FOLLOW_UP_ID: 'submitter_follow_up_id',
	INTERVAL_OF_FOLLOWUP: 'interval_of_followup',
	DISEASE_STATUS_AT_FOLLOWUP: 'disease_status_at_followup',
	RELEASE_TYPE: 'relapse_type',
	RELAPSE_INTERVAL: 'relapse_interval',
	METHOD_OF_PROGRESSION_STATUS: 'method_of_progression_status',
	ANATOMIC_SITE_PROGRESSION_OR_RECURRENCES: 'anatomic_site_progression_or_recurrences',
	RECURRENCE_TUMOUR_STAGING_SYSTEM: 'recurrence_tumour_staging_system',
	RECURRENCE_T_CATEGORY: 'recurrence_t_category',
	RECURRENCE_N_CATEGORY: 'recurrence_n_category',
	RECURRENCE_M_CATEGORY: 'recurrence_m_category',
	RECURRENCE_STAGE_GROUP: 'recurrence_stage_group',
	POSTTHERAPY_TUMOUR_STAGING_SYSTEM: 'posttherapy_tumour_staging_system',
	POSTTHERAPY_T_CATEGORY: 'posttherapy_t_category',
	POSTTHERAPY_N_CATEGORY: 'posttherapy_n_category',
	POSTTHERAPY_M_CATEGORY: 'posttherapy_m_category',
	POSTTHERAPY_STAGE_GROUP: 'posttherapy_stage_group',
};

export const treatment = {
	PROGRAM_ID: 'program_id',
	SUBMITTER_DONOR_ID: 'submitter_donor_id',
	SUBMITTER_TREATMENT_ID: 'submitter_treatment_id',
	TREATMENT_TYPE: 'treatment_type',
	AGE_AT_CONSENT_FOR_TREATMENT: 'age_at_consent_for_treatment',
	IS_PRIMARY_TREATMENT: 'is_primary_treatment',
	TREATMENT_START_INTERVAL: 'treatment_start_interval',
	TREATMENT_DURATION: 'treatment_duration',
	DAYS_PER_CYCLE: 'days_per_cycle',
	THERAPEUTIC_INTENT: 'therapeutic_intent',
	RESPONSE_TO_THERAPY: 'response_to_therapy',
};

export const chemotherapy = {
	PROGRAM_ID: 'program_id',
	SUBMITTER_DONOR_ID: 'submitter_donor_id',
	SUBMITTER_TREATMENT_ID: 'submitter_treatment_id',
	CHEMOTHERAPY_DRUG_NAME: 'chemotherapy_drug_name',
	CHEMOTHERAPY_DOSAGE_UNITS: 'chemotherapy_dosage_units',
	CUMULATIVE_DRUG_DOSAGE: 'cumulative_drug_dosage',
};

export const radiation = {
	PROGRAM_ID: 'program_id',
	SUBMITTER_DONOR_ID: 'submitter_donor_id',
	SUBMITTER_TREATMENT_ID: 'submitter_treatment_id',
	RADIATION_THERAPY_MODALITY: 'radiation_therapy_modality',
	APPLICATION_FORM: 'application_form',
	RADIATION_THERAPY_FRACTIONS: 'radiation_therapy_fractions',
	RADIATION_THERAPY_DOSAGE: 'radiation_therapy_dosage',
	ANATOMICAL_SITE_IRRADIATED: 'anatomical_site_irradiated',
	RADIATION_BOOST: 'radiation_boost',
	REFERENCE_RADIATION_TREATMENT_ID: 'reference_radiation_treatment_id',
};

export const hormonetherapy = {
	PROGRAM_ID: 'program_id',
	SUBMITTER_DONOR_ID: 'submitter_donor_id',
	SUBMITTER_TREATMENT_ID: 'submitter_treatment_id',
	HORMONE_THERAPY_DRUG_NAME: 'hormone_therapy_drug_name',
	HORMONE_DRUG_DOSAGE_UNITS: 'hormone_drug_dosage_units',
	CUMULATIVE_DRUG_DOSAGE: 'cumulative_drug_dosage',
};
