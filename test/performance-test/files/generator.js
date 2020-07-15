var fs = require('fs');

let sampleRegistration =
  'program_id	submitter_donor_id	gender	submitter_specimen_id	specimen_tissue_source	tumour_normal_designation	specimen_type	submitter_sample_id	sample_type';
let donor =
  'program_id	submitter_donor_id	vital_status	cause_of_death	survival_time	primary_site	prior_malignancy	cancer_type_prior_malignancy	age_at_prior_malignancy	laterality_of_prior_malignancy	height	weight	bmi	menopause_status	age_at_menarche	number_of_pregnancies	number_of_children';
let pd =
  'program_id	number_lymph_nodes_positive	submitter_donor_id	submitter_primary_diagnosis_id	age_at_diagnosis	cancer_type_code	clinical_tumour_staging_system	presenting_symptoms	clinical_stage_group	clinical_t_category	clinical_n_category	clinical_m_category';
let specimen =
  'program_id	submitter_donor_id	submitter_primary_diagnosis_id	submitter_specimen_id	specimen_acquisition_interval	specimen_anatomic_location	reference_pathology_confirmed	tumour_histological_type	tumour_grading_system	tumour_grade	pathological_tumour_staging_system	pathological_stage_group	percent_tumour_cells	percent_proliferating_cells	percent_inflammatory_tissue	percent_stromal_cells	percent_necrosis	pathological_m_category	pathological_n_category	pathological_t_category';

for (let i = 0; i < 3000; i = i + 2) {
  sampleRegistration =
    sampleRegistration +
    `
TEST-CA	ICGC_${i}	Other	s_specimen_ICGC_${i}	Other	Normal	Normal	s_sample_ICGC_${i}	Total DNA
TEST-CA	ICGC_${i + 1}	Other	s_specimen_ICGC_${i + 1}	Other	Tumour	Primary tumour	s_sample_ICGC_${i +
      1}	Total RNA`;

  donor =
    donor +
    `
TEST-CA	ICGC_${i}	Alive			Unknown	Unknown				170	70		Not applicable		1	1
TEST-CA	ICGC_${i + 1}	Deceased	Died of cancer	365	Unknown	Unknown				170	70		Not applicable		1	1`;

  pd =
    pd +
    `
TEST-CA	1	ICGC_${i}	s__pd_${i}	30	D46.2	Binet staging system	None	stage a
TEST-CA	2	ICGC_${i + 1}	s__pd_${i + 1}	55	C41.1	AJCC 8th edition	None|Unknown	stage 0	T0	N0	M1`;

  specimen =
    specimen +
    `
TEST-CA	ICGC_${i}	s__pd_${i}	s_specimen_ICGC_${i}	50	C50.1
TEST-CA	ICGC_${i + 1}	s__pd_${i + 1}	s_specimen_ICGC_${i +
      1}	200	C18	Yes	9691/36	Four-tier grading system	GX	Rai staging system	stage 0	0.35	0.5	0.6	0.65	0.65`;
}

fs.writeFile('sample_registration.3000.tsv', sampleRegistration, function(err) {
  if (err) throw err;
  console.log('Saved SR!');
});

fs.writeFile('donor.3000.tsv', donor, function(err) {
  if (err) throw err;
  console.log('Saved donor!');
});

fs.writeFile('primary_diagnosis.3000.tsv', pd, function(err) {
  if (err) throw err;
  console.log('Saved pd!');
});

fs.writeFile('specimen.3000.tsv', specimen, function(err) {
  if (err) throw err;
  console.log('Saved specimen!');
});
