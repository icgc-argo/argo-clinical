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

import { Donor } from '../../../src/clinical/clinical-entities';
import {
  DonorFieldsEnum,
  FollowupFieldsEnum,
  TreatmentFieldsEnum,
  TherapyRxNormFields,
  PrimaryDiagnosisFieldsEnum,
  SpecimenFieldsEnum,
  SurgeryFieldsEnum,
} from '../../../src/common-model/entities';

/**
 * strongly typed stubs file!!
 */
export const stubs = {
  validation: {
    existingDonor01: (): Donor => ({
      schemaMetadata: {
        isValid: true,
        lastValidSchemaVersion: '1.0',
        originalSchemaVersion: '1.0',
      },
      _id: 'i8321321',
      submitterId: 'AB1',
      programId: 'PEME-CA',
      donorId: 10,
      clinicalInfo: {},
      gender: 'Female',
      specimens: [
        {
          submitterId: 'SP1',
          specimenTissueSource: 'XYZ',
          clinicalInfo: {},
          tumourNormalDesignation: 'Normal',
          specimenType: 'Normal',
          samples: [
            {
              sampleType: 'ST1',
              submitterId: 'AM1',
            },
          ],
        },
        {
          submitterId: 'SP13',
          specimenTissueSource: 'XYZ',
          clinicalInfo: {},
          tumourNormalDesignation: 'Normal',
          specimenType: 'Normal',
          samples: [],
        },
        {
          submitterId: 'SP14',
          specimenTissueSource: 'XYZ',
          clinicalInfo: {},
          tumourNormalDesignation: 'Normal',
          specimenType: 'Normal',
          samples: [],
        },
      ],
    }),

    existingDonor02: (): Donor => ({
      schemaMetadata: {
        isValid: true,
        lastValidSchemaVersion: '1.0',
        originalSchemaVersion: '1.0',
      },
      _id: 'juadskasd23',
      submitterId: 'AB1',
      programId: 'PEME-CA',
      donorId: 10,
      clinicalInfo: {},
      gender: 'Female',
      specimens: [
        {
          submitterId: 'SP1',
          specimenTissueSource: 'XYZZ',
          clinicalInfo: {},
          tumourNormalDesignation: 'Normal',
          specimenType: 'Normal',
          samples: [
            {
              sampleType: 'ST11',
              submitterId: 'AM1',
            },
          ],
        },
      ],
    }),

    existingDonor03: (): Donor => ({
      schemaMetadata: {
        isValid: true,
        lastValidSchemaVersion: '1.0',
        originalSchemaVersion: '1.0',
      },
      _id: 'juadskasd122',
      submitterId: 'AB3',
      programId: 'PEME-CA',
      donorId: 10,
      clinicalInfo: {},
      gender: 'Female',
      specimens: [
        {
          submitterId: 'SP12',
          specimenTissueSource: 'XYZZ',
          clinicalInfo: {},
          tumourNormalDesignation: 'Normal',
          specimenType: 'Normal',
          samples: [
            {
              sampleType: 'ST10',
              submitterId: 'AM1',
            },
          ],
        },
      ],
    }),

    existingDonor04: (): Donor => ({
      schemaMetadata: {
        isValid: true,
        lastValidSchemaVersion: '1.0',
        originalSchemaVersion: '1.0',
      },
      _id: 'juadskasd122',
      submitterId: 'AB2',
      programId: 'PEME-CA',
      donorId: 10,
      clinicalInfo: {
        [DonorFieldsEnum.vital_status]: 'Deceased',
        [DonorFieldsEnum.survival_time]: 522,
      },
      gender: 'Female',
      specimens: [
        {
          submitterId: 'SP13',
          specimenTissueSource: 'Other',
          clinicalInfo: {},
          tumourNormalDesignation: 'Normal',
          specimenType: 'Normal',
          samples: [
            {
              sampleType: 'ST10',
              submitterId: 'AM1',
            },
          ],
        },
        {
          submitterId: 'SP14',
          specimenTissueSource: 'Other',
          clinicalInfo: {},
          tumourNormalDesignation: 'Normal',
          specimenType: 'Normal',
          samples: [
            {
              sampleType: 'ST10',
              submitterId: 'AM2',
            },
          ],
        },
        {
          submitterId: 'SP15',
          specimenTissueSource: 'Other',
          clinicalInfo: {},
          tumourNormalDesignation: 'Tumour',
          specimenType: 'Recurrent tumour',
          samples: [
            {
              sampleType: 'ST10',
              submitterId: 'AM2',
            },
          ],
        },
        {
          submitterId: 'SP15.1',
          specimenTissueSource: 'Other',
          clinicalInfo: {},
          tumourNormalDesignation: 'Normal',
          specimenType: 'Normal',
          samples: [
            {
              sampleType: 'ST10',
              submitterId: 'AM2',
            },
          ],
        },
      ],
    }),

    existingDonor05: (): Donor => ({
      schemaMetadata: {
        isValid: true,
        lastValidSchemaVersion: '1.0',
        originalSchemaVersion: '1.0',
      },
      _id: 'c2f23r23f',
      submitterId: 'AB2',
      programId: 'PEME-CA',
      donorId: 10,
      clinicalInfo: {
        [DonorFieldsEnum.vital_status]: 'Deceased',
        [DonorFieldsEnum.survival_time]: 522,
      },
      gender: 'Female',
      specimens: [
        {
          submitterId: 'SP13',
          specimenTissueSource: 'Other',
          clinicalInfo: {},
          tumourNormalDesignation: 'Normal',
          specimenType: 'Normal',
          samples: [
            {
              sampleType: 'ST10',
              submitterId: 'AM1',
            },
          ],
        },
        {
          submitterId: 'SP14',
          specimenTissueSource: 'Other',
          clinicalInfo: {},
          tumourNormalDesignation: 'Normal',
          specimenType: 'Normal',
          samples: [
            {
              sampleType: 'ST10',
              submitterId: 'AM2',
            },
          ],
        },
      ],
      followUps: [
        {
          followUpId: 1,
          clinicalInfo: {
            [FollowupFieldsEnum.submitter_follow_up_id]: 'FF123',
            some_field: 1,
            another_field: 'abcd',
          },
        },
      ],
    }),

    existingDonor06: (): Donor => ({
      schemaMetadata: {
        isValid: true,
        lastValidSchemaVersion: '1.0',
        originalSchemaVersion: '1.0',
      },
      _id: '22f23223f',
      submitterId: 'AB2',
      programId: 'PEME-CA',
      donorId: 10,
      clinicalInfo: {
        [DonorFieldsEnum.vital_status]: 'Deceased',
      },
      gender: 'Female',
      specimens: [
        {
          submitterId: 'SPID1',
          specimenTissueSource: 'Other',
          clinicalInfo: {},
          tumourNormalDesignation: 'Normal',
          specimenType: 'Normal',
          samples: [
            {
              sampleType: 'Other',
              submitterId: 'SID1',
            },
          ],
        },
        {
          submitterId: 'SP1',
          specimenTissueSource: 'Other',
          clinicalInfo: {},
          tumourNormalDesignation: 'Normal',
          specimenType: 'Normal',
          samples: [],
        },
      ],
      followUps: [],
      treatments: [
        {
          treatmentId: 1,
          clinicalInfo: {
            [TreatmentFieldsEnum.submitter_treatment_id]: 'T_03',
            fieldOne: 'field1',
          },
          therapies: [],
        },
      ],
    }),

    existingDonor10: (): Donor => ({
      schemaMetadata: {
        isValid: true,
        lastValidSchemaVersion: '1.0',
        originalSchemaVersion: '1.0',
      },
      _id: '22f23223f',
      submitterId: 'AB10',
      programId: 'PEME-CA',
      donorId: 10,
      primaryDiagnoses: [
        {
          primaryDiagnosisId: 1,
          clinicalInfo: {
            [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'AB10',
            [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP1',
          },
        },
      ],
      clinicalInfo: {
        [DonorFieldsEnum.vital_status]: 'Deceased',
      },
      gender: 'Female',
      specimens: [
        {
          submitterId: 'SPID1',
          specimenTissueSource: 'Other',
          clinicalInfo: {},
          tumourNormalDesignation: 'Normal',
          specimenType: 'Normal',
          samples: [
            {
              sampleType: 'Other',
              submitterId: 'SID1',
            },
          ],
        },
      ],
      followUps: [],
      treatments: [
        {
          treatmentId: 1,
          clinicalInfo: {
            [TreatmentFieldsEnum.submitter_treatment_id]: 'T_03',
            [TreatmentFieldsEnum.submitter_donor_id]: 'AB10',
            [TreatmentFieldsEnum.submitter_primary_diagnosis_id]: 'PP1',
            [TreatmentFieldsEnum.treatment_type]: ['Chemotherapy', 'Radiation therapy'],
          },
          therapies: [
            {
              therapyType: 'radiation',
              clinicalInfo: {
                [TreatmentFieldsEnum.submitter_treatment_id]: 'T_03',
              },
            },
            {
              therapyType: 'chemotherapy',
              clinicalInfo: {
                [TreatmentFieldsEnum.submitter_treatment_id]: 'T_03',
                [TreatmentFieldsEnum.submitter_donor_id]: 'AB10',
                [TherapyRxNormFields.drug_name]: 'd1',
                [TherapyRxNormFields.drug_rxnormid]: '1234',
              },
            },
          ],
        },
      ],
    }),

    existingDonor07: (): Donor => ({
      schemaMetadata: {
        isValid: true,
        lastValidSchemaVersion: '1.0',
        originalSchemaVersion: '1.0',
      },
      _id: '22f23223f',
      submitterId: 'AB2',
      programId: 'PEME-CA',
      donorId: 20,
      clinicalInfo: {
        [DonorFieldsEnum.vital_status]: 'Alive',
      },
      gender: 'Female',
      specimens: [],
      followUps: [],
      treatments: [],
    }),
    existingDonor08: (): Donor => ({
      schemaMetadata: {
        isValid: true,
        lastValidSchemaVersion: '1.0',
        originalSchemaVersion: '1.0',
      },
      _id: '22f23223f',
      submitterId: 'ICGC_0002',
      programId: 'TEST-CA',
      donorId: 250001,
      clinicalInfo: {
        [DonorFieldsEnum.program_id]: 'TEST-CA',
        [DonorFieldsEnum.submitter_donor_id]: 'ICGC_0002',
        [DonorFieldsEnum.vital_status]: 'Deceased',
        [DonorFieldsEnum.survival_time]: 9,
      },
      gender: 'Female',
      specimens: [
        {
          specimenId: 210001,
          submitterId: 'sub-sp-pacaau-124',
          specimenTissueSource: 'Saliva',
          clinicalInfo: {
            [SpecimenFieldsEnum.program_id]: 'TEST-CA',
            [SpecimenFieldsEnum.submitter_donor_id]: 'ICGC_0002',
            [SpecimenFieldsEnum.submitter_primary_diagnosis_id]: 'P4',
            [SpecimenFieldsEnum.submitter_specimen_id]: 'sub-sp-pacaau-124',
            [SpecimenFieldsEnum.specimen_acquisition_interval]: 200,
          },
          tumourNormalDesignation: 'Tumour',
          specimenType: 'Primary tumour',
          samples: [
            {
              sampleType: 'Total RNA',
              submitterId: 'sm123-2',
              sampleId: 610003,
            },
          ],
        },
        {
          specimenId: 210002,
          submitterId: 'sub-sp-2-220',
          specimenTissueSource: 'Saliva',
          clinicalInfo: {},
          tumourNormalDesignation: 'Tumour',
          specimenType: 'Primary tumour',
          samples: [
            {
              sampleType: 'Total RNA',
              submitterId: 'sm-2-220-1',
              sampleId: 610001,
            },
          ],
        },
      ],
      followUps: [
        {
          followUpId: 1,
          clinicalInfo: {
            [FollowupFieldsEnum.program_id]: 'TEST-CA',
            [FollowupFieldsEnum.submitter_donor_id]: 'ICGC_0002',
            [FollowupFieldsEnum.submitter_follow_up_id]: 'FLL1234',
            [FollowupFieldsEnum.submitter_treatment_id]: 'T_02',
            [FollowupFieldsEnum.interval_of_followup]: 10,
          },
        },
        {
          followUpId: 2,
          clinicalInfo: {
            [FollowupFieldsEnum.program_id]: 'TEST-CA',
            [FollowupFieldsEnum.submitter_donor_id]: 'ICGC_0002',
            [FollowupFieldsEnum.submitter_treatment_id]: 'T_02',
            [FollowupFieldsEnum.submitter_follow_up_id]: 'FLL1235',
            [FollowupFieldsEnum.interval_of_followup]: 45,
          },
        },
      ],
      treatments: [
        {
          treatmentId: 3,
          clinicalInfo: {
            [TreatmentFieldsEnum.program_id]: 'TEST-CA',
            [TreatmentFieldsEnum.submitter_treatment_id]: 'T_02',
            [TreatmentFieldsEnum.submitter_donor_id]: 'ICGC_0002',
            [TreatmentFieldsEnum.submitter_primary_diagnosis_id]: 'P4',
            [TreatmentFieldsEnum.treatment_type]: ['Chemotherapy'],
            [TreatmentFieldsEnum.treatment_start_interval]: 5,
          },
          therapies: [
            {
              therapyType: 'chemotherapy',
              clinicalInfo: {
                [TreatmentFieldsEnum.program_id]: 'TEST-CA',
                [TreatmentFieldsEnum.submitter_donor_id]: 'ICGC_0002',
                [TreatmentFieldsEnum.submitter_treatment_id]: 'T_02',
                [TherapyRxNormFields.drug_name]: 'Aminobenzoic Acid',
                [TherapyRxNormFields.drug_rxnormid]: '74',
              },
            },
          ],
        },
      ],
      primaryDiagnoses: [
        {
          primaryDiagnosisId: 3,
          clinicalInfo: {
            [PrimaryDiagnosisFieldsEnum.program_id]: 'TEST-CA',
            [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'ICGC_0002',
            [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'P4',
            [PrimaryDiagnosisFieldsEnum.age_at_diagnosis]: 96,
            [PrimaryDiagnosisFieldsEnum.cancer_type_code]: 'C41.1',
          },
        },
      ],
    }),

    existingDonor09: (): Donor => ({
      schemaMetadata: {
        isValid: true,
        lastValidSchemaVersion: '1.0',
        originalSchemaVersion: '1.0',
      },
      _id: '22f23223f',
      submitterId: 'ICGC_0002',
      programId: 'TEST-CA',
      donorId: 250001,
      clinicalInfo: {
        [DonorFieldsEnum.program_id]: 'TEST-CA',
        [DonorFieldsEnum.submitter_donor_id]: 'ICGC_0002',
        [DonorFieldsEnum.vital_status]: 'Deceased',
        [DonorFieldsEnum.survival_time]: 9,
      },
      gender: 'Female',
      specimens: [
        {
          specimenId: 210001,
          submitterId: 'sp-1',
          specimenTissueSource: 'Saliva',
          clinicalInfo: {
            [SpecimenFieldsEnum.program_id]: 'TEST-CA',
            [SpecimenFieldsEnum.submitter_donor_id]: 'ICGC_0002',
            [SpecimenFieldsEnum.submitter_primary_diagnosis_id]: 'P1',
            [SpecimenFieldsEnum.submitter_specimen_id]: 'sp-1',
            [SpecimenFieldsEnum.specimen_acquisition_interval]: 200,
          },
          tumourNormalDesignation: 'Tumour',
          specimenType: 'Primary tumour',
          samples: [
            {
              sampleType: 'Total RNA',
              submitterId: 'sm123-2',
              sampleId: 610003,
            },
          ],
        },
        {
          specimenId: 210002,
          submitterId: 'sp-2',
          specimenTissueSource: 'Saliva',
          clinicalInfo: {
            [SpecimenFieldsEnum.program_id]: 'TEST-CA',
            [SpecimenFieldsEnum.submitter_donor_id]: 'ICGC_0002',
            [SpecimenFieldsEnum.submitter_primary_diagnosis_id]: 'P2',
            [SpecimenFieldsEnum.submitter_specimen_id]: 'sp-2',
            [SpecimenFieldsEnum.specimen_acquisition_interval]: 200,
          },
          tumourNormalDesignation: 'Tumour',
          specimenType: 'Primary tumour',
          samples: [
            {
              sampleType: 'Total RNA',
              submitterId: 'sm-2-220-1',
              sampleId: 610001,
            },
          ],
        },
      ],
      treatments: [
        {
          treatmentId: 3,
          clinicalInfo: {
            [TreatmentFieldsEnum.program_id]: 'TEST-CA',
            [TreatmentFieldsEnum.submitter_treatment_id]: 'Tr-1',
            [TreatmentFieldsEnum.submitter_donor_id]: 'ICGC_0002',
            [TreatmentFieldsEnum.submitter_primary_diagnosis_id]: 'P1',
            [TreatmentFieldsEnum.treatment_type]: ['Surgery'],
            [TreatmentFieldsEnum.treatment_start_interval]: 5,
          },
          therapies: [
            {
              therapyType: 'surgery',
              clinicalInfo: {
                [TreatmentFieldsEnum.program_id]: 'TEST-CA',
                [TreatmentFieldsEnum.submitter_donor_id]: 'ICGC_0002',
                [TreatmentFieldsEnum.submitter_treatment_id]: 'Tr-1',
                [SurgeryFieldsEnum.submitter_specimen_id]: 'sp-1',
                [SurgeryFieldsEnum.surgery_type]: 'Biopsy',
              },
            },
          ],
        },
      ],
      primaryDiagnoses: [
        {
          primaryDiagnosisId: 3,
          clinicalInfo: {
            [PrimaryDiagnosisFieldsEnum.program_id]: 'TEST-CA',
            [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'ICGC_0002',
            [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'P1',
            [PrimaryDiagnosisFieldsEnum.age_at_diagnosis]: 96,
            [PrimaryDiagnosisFieldsEnum.cancer_type_code]: 'C41.1',
          },
        },
        {
          primaryDiagnosisId: 3,
          clinicalInfo: {
            [PrimaryDiagnosisFieldsEnum.program_id]: 'TEST-CA',
            [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'ICGC_0002',
            [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'P2',
            [PrimaryDiagnosisFieldsEnum.age_at_diagnosis]: 96,
            [PrimaryDiagnosisFieldsEnum.cancer_type_code]: 'C41.1',
          },
        },
      ],
    }),
  },
};
