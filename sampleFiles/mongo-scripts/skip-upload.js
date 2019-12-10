/**
 * This script contains commands to manipulate the local test db to speed up
 * development and data prepration
 */

// delete all donors
db.donors.drop();

// find all donors
db.donors.find({});

// insert many donors
db.donors.insertMany([
  {
    schemaMetadata: {
      lastValidSchemaVersion: '1.0',
      currentSchemaVersion: '1.0',
      isValid: true,
      originalSchemaVersion: '1.0',
    },
    gender: 'Male',
    submitterId: 'ICGC_0001.1',
    programId: 'PACA-AU',
    specimens: [
      {
        samples: [
          {
            sampleType: 'Total DNA',
            submitterId: 'sm123-1',
            sampleId: 1,
          },
        ],
        specimenTissueSource: 'Other',
        tumourNormalDesignation: 'Normal',
        submitterId: 'sub-sp-pacaau-123',
        specimenId: 1,
        clinicalInfo: {
          submitter_donor_id: 'ICGC_0001.1',
          submitter_specimen_id: 'sub-sp-pacaau-123',
          acquisition_interval: 200,
          anatomic_location_of_specimen_collection: 'Other',
          central_pathology_confirmed: 'No',
          tumour_histological_type: 'M-1111/22',
          tumour_grading_system: 'Default',
          tumour_grade: 'aStringValue',
          tumour_staging_system: 'Murphy',
          pathological_stage_group: 'aStringValue',
          percent_tumour_cells: 0.35,
          percent_proliferating_cells: 0.5,
          percent_inflammatory_tissue: 0.6,
          percent_stromal_cells: 0.65,
          percent_necrosis: 0.65,
          pathological_t_category: null,
          pathological_n_category: null,
          pathological_m_category: null,
        },
      },
    ],
    createdAt: '2019-11-19T19:05:56.742Z',
    updatedAt: '2019-11-19T19:10:55.052Z',
    donorId: 1,
    __v: 1,
    clinicalInfo: {
      submitter_donor_id: 'ICGC_0001.1',
      vital_status: 'Deceased',
      cause_of_death: 'Died of cancer',
      survival_time: 540,
    },
    primaryDiagnosis: {
      submitter_donor_id: 'ICGC_0001.1',
      age_at_diagnosis: 96,
      cancer_type_code: 'A11.1A',
      tumour_staging_system: 'Murphy',
      clinical_stage_group: null,
      stage_suffix: null,
      clinical_t_category: null,
      clinical_n_category: null,
      clinical_m_category: null,
      number_lymph_nodes_examined: null,
      presenting_symptoms: null,
      menopause_status: null,
    },
  },
  {
    followUps: [],
    treatments: [],
    chemotherapy: [],
    hormoneTherapy: [],
    schemaMetadata: {
      lastValidSchemaVersion: '1.0',
      currentSchemaVersion: '1.0',
      isValid: true,
      originalSchemaVersion: '1.0',
    },
    gender: 'Female',
    submitterId: 'ICGC_0002',
    programId: 'PACA-AU',
    specimens: [
      {
        samples: [
          {
            sampleType: 'Total RNA',
            submitterId: 'sm123-2',
            sampleId: 2,
          },
        ],
        specimenTissueSource: 'Saliva',
        tumourNormalDesignation: 'Primary tumour',
        submitterId: 'sub-sp-pacaau-124',
        specimenId: 2,
      },
    ],
    createdAt: '2019-11-19T19:05:56.762Z',
    updatedAt: '2019-11-19T19:10:55.052Z',
    donorId: 2,
    __v: 1,
    clinicalInfo: {
      submitter_donor_id: 'ICGC_0002',
      vital_status: 'Alive',
      cause_of_death: null,
      survival_time: null,
    },
  },
  {
    followUps: [],
    treatments: [],
    chemotherapy: [],
    hormoneTherapy: [],
    schemaMetadata: {
      lastValidSchemaVersion: '1.0',
      currentSchemaVersion: '1.0',
      isValid: true,
      originalSchemaVersion: '1.0',
    },
    gender: 'Male',
    submitterId: 'ICGC_0003',
    programId: 'PACA-AU',
    specimens: [
      {
        samples: [
          {
            sampleType: 'Amplified DNA',
            submitterId: 'sm123-3',
            sampleId: 3,
          },
        ],
        specimenTissueSource: 'Saliva',
        tumourNormalDesignation: 'Primary tumour',
        submitterId: 'sub-sp-pacaau-125',
        specimenId: 3,
      },
    ],
    createdAt: '2019-11-19T19:05:56.779Z',
    updatedAt: '2019-11-19T19:10:55.052Z',
    donorId: 3,
    __v: 1,
    clinicalInfo: {
      submitter_donor_id: 'ICGC_0003',
      vital_status: 'Deceased',
      cause_of_death: 'Died of cancer',
      survival_time: 522,
    },
  },
]);
