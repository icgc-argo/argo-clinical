/**
 * This script contains commands to manipulate the local test db to speed up
 * development and data prepration
 */

// delete all donors
db.donors.drop();

// find all donors
db.donors.find({});

// register donors (no clinical data)
db.donors.insertMany([
  {
    followUps: [],
    schemaMetadata: {
      lastValidSchemaVersion: '20.0',
      isValid: true,
      originalSchemaVersion: '20.0',
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
      },
    ],
    treatments: [],
    createdAt: '2019-12-10T16:40:54.472Z',
    updatedAt: '2019-12-10T16:40:54.472Z',
    donorId: 1,
    __v: 0,
  },
  {
    followUps: [],
    schemaMetadata: {
      lastValidSchemaVersion: '20.0',
      isValid: true,
      originalSchemaVersion: '20.0',
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
    treatments: [],
    createdAt: '2019-12-10T16:40:54.504Z',
    updatedAt: '2019-12-10T16:40:54.504Z',
    donorId: 2,
    __v: 0,
  },
  {
    followUps: [],
    schemaMetadata: {
      lastValidSchemaVersion: '20.0',
      isValid: true,
      originalSchemaVersion: '20.0',
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
    treatments: [],
    createdAt: '2019-12-10T16:40:54.537Z',
    updatedAt: '2019-12-10T16:40:54.537Z',
    donorId: 3,
    __v: 0,
  },
]);

// create clinical submission
db.activesubmissions.insert({
  state: 'OPEN',
  programId: 'PACA-AU',
  version: '8efc31ac-6419-4493-8ddc-8d05d7d070b7',
  clinicalEntities: {
    donor: {
      batchName: 'donor.tsv',
      creator: 'bashar labadi',
      createdAt: '2019-12-10T16:43:52.390Z',
      schemaErrors: [],
      records: [
        {
          program_id: 'PACA-AU',
          submitter_donor_id: 'ICGC_0001.1',
          vital_status: 'Deceased',
          cause_of_death: 'Died of other reasons',
          survival_time: 540,
        },
        {
          program_id: 'PACA-AU',
          submitter_donor_id: 'ICGC_0002',
          vital_status: 'Alive',
          cause_of_death: null,
          survival_time: null,
        },
        {
          program_id: 'PACA-AU',
          submitter_donor_id: 'ICGC_0003',
          vital_status: 'Deceased',
          cause_of_death: 'Died of cancer',
          survival_time: 522,
        },
      ],
      dataErrors: [],
      dataUpdates: [],
      stats: {
        new: [],
        noUpdate: [],
        updated: [],
        errorsFound: [],
      },
    },
    specimen: {
      batchName: 'specimen.tsv',
      creator: 'bashar labadi',
      createdAt: '2019-12-10T16:43:52.390Z',
      schemaErrors: [],
      records: [
        {
          program_id: 'PACA-AU',
          submitter_donor_id: 'ICGC_0001.1',
          submitter_specimen_id: 'sub-sp-pacaau-123',
          acquisition_interval: 200,
          specimen_anatomic_location: 'Other',
          central_pathology_confirmed: 'No',
          tumour_histological_type: 'M-1111/22',
          tumour_grading_system: 'Default',
          tumour_grade: 'aStringValue',
          pathological_tumour_staging_system: 'Murphy',
          pathological_stage_group: 'aStringValue',
          percent_tumour_cells: 0.35,
          percent_proliferating_cells: 0.5,
          percent_inflammatory_tissue: 0.6,
          percent_stromal_cells: 0.65,
          percent_necrosis: 0.65,
        },
      ],
      dataErrors: [],
      dataUpdates: [],
      stats: {
        new: [],
        noUpdate: [],
        updated: [],
        errorsFound: [],
      },
    },
    primary_diagnosis: {
      batchName: 'primary_diagnosis.tsv',
      creator: 'bashar labadi',
      createdAt: '2019-12-10T16:43:52.390Z',
      schemaErrors: [],
      records: [
        {
          program_id: 'PACA-AU',
          number_lymph_nodes_positive: 2,
          submitter_donor_id: 'ICGC_0001.1',
          age_at_diagnosis: 96,
          cancer_type_code: 'A11.1A',
          clinical_tumour_staging_system: 'Murphy',
        },
      ],
      dataErrors: [],
      dataUpdates: [],
      stats: {
        new: [],
        noUpdate: [],
        updated: [],
        errorsFound: [],
      },
    },
  },
  updatedBy: 'bashar labadi',
  createdAt: '2019-12-10T16:43:52.383Z',
  updatedAt: '2019-12-10T16:43:52.483Z',
  __v: 0,
});

// inserts donors WITH clinical data
db.insertMany([
  [
    {
      followUps: [],
      schemaMetadata: {
        lastValidSchemaVersion: '20.0',
        isValid: true,
        originalSchemaVersion: '20.0',
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
            program_id: 'PACA-AU',
            submitter_donor_id: 'ICGC_0001.1',
            submitter_specimen_id: 'sub-sp-pacaau-123',
            acquisition_interval: 200,
            specimen_anatomic_location: 'Other',
            central_pathology_confirmed: 'No',
            tumour_histological_type: 'M-1111/22',
            tumour_grading_system: 'Default',
            tumour_grade: 'aStringValue',
            pathological_tumour_staging_system: 'Murphy',
            pathological_stage_group: 'aStringValue',
            percent_tumour_cells: 0.35,
            percent_proliferating_cells: 0.5,
            percent_inflammatory_tissue: 0.6,
            percent_stromal_cells: 0.65,
            percent_necrosis: 0.65,
          },
        },
      ],
      treatments: [],
      createdAt: '2019-12-10T16:40:54.472Z',
      updatedAt: '2019-12-10T16:52:15.914Z',
      donorId: 1,
      __v: 1,
      clinicalInfo: {
        program_id: 'PACA-AU',
        submitter_donor_id: 'ICGC_0001.1',
        vital_status: 'Deceased',
        cause_of_death: 'Died of other reasons',
        survival_time: 540,
      },
      primaryDiagnosis: {
        program_id: 'PACA-AU',
        number_lymph_nodes_positive: 2,
        submitter_donor_id: 'ICGC_0001.1',
        age_at_diagnosis: 96,
        cancer_type_code: 'A11.1A',
        clinical_tumour_staging_system: 'Murphy',
      },
    },
    {
      followUps: [],
      schemaMetadata: {
        lastValidSchemaVersion: '20.0',
        isValid: true,
        originalSchemaVersion: '20.0',
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
      treatments: [],
      createdAt: '2019-12-10T16:40:54.504Z',
      updatedAt: '2019-12-10T16:52:15.914Z',
      donorId: 2,
      __v: 1,
      clinicalInfo: {
        program_id: 'PACA-AU',
        submitter_donor_id: 'ICGC_0002',
        vital_status: 'Alive',
        cause_of_death: null,
        survival_time: null,
      },
    },
    {
      followUps: [],
      schemaMetadata: {
        lastValidSchemaVersion: '20.0',
        isValid: true,
        originalSchemaVersion: '20.0',
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
      treatments: [],
      createdAt: '2019-12-10T16:40:54.537Z',
      updatedAt: '2019-12-10T16:52:15.914Z',
      donorId: 3,
      __v: 1,
      clinicalInfo: {
        program_id: 'PACA-AU',
        submitter_donor_id: 'ICGC_0003',
        vital_status: 'Deceased',
        cause_of_death: 'Died of cancer',
        survival_time: 522,
      },
    },
  ],
]);
