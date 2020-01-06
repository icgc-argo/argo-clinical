import { Donor } from '../../../src/clinical/clinical-entities';
import {
  DonorFieldsEnum,
  FollowupFieldsEnum,
  TreatmentFieldsEnum,
} from '../../../src/submission/submission-entities';

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
        [DonorFieldsEnum.vital_status]: 'deceased',
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
        [DonorFieldsEnum.vital_status]: 'deceased',
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
        [DonorFieldsEnum.vital_status]: 'deceased',
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
          clinicalInfo: {
            [TreatmentFieldsEnum.submitter_treatment_id]: 'T_03',
            fieldOne: 'field1',
          },
          therapies: [],
        },
      ],
    }),
  },
};
