import { Donor } from '../../../src/clinical/clinical-entities';

/**
 * strongly typed stubs file!!
 */
export const stubs = {
  validation: {
    existingDonor01: (): Donor => ({
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
      _id: 'juadskasd122',
      submitterId: 'AB2',
      programId: 'PEME-CA',
      donorId: 10,
      clinicalInfo: {
        vital_status: 'deceased',
        survival_time: '522',
      },
      gender: 'Female',
      specimens: [
        {
          submitterId: 'SP13',
          specimenTissueSource: 'Other',
          clinicalInfo: {},
          tumourNormalDesignation: 'Normal',
          samples: [
            {
              sampleType: 'ST10',
              submitterId: 'AM1',
            },
          ],
        },
      ],
    }),
  },
};
