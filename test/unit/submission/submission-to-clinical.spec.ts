import chai from 'chai';
import * as sinon from 'sinon';
import * as s2c from '../../../src/submission/submission-to-clinical/submission-to-clinical';

import { registrationRepository } from '../../../src/submission/registration-repo';
import { donorDao, FindByProgramAndSubmitterFilter } from '../../../src/clinical/donor-repo';
import {
  ActiveRegistration,
  ClinicalEntitySchemaNames,
} from '../../../src/submission/submission-entities';
import { Donor, ClinicalEntity } from '../../../src/clinical/clinical-entities';
import deepFreeze from 'deep-freeze';
import * as schemaManager from '../../../src/submission/schema/schema-manager';
import { updateClinicalStatsAndDonorStats } from '../../../src/submission/submission-to-clinical/stat-calculator';

const id1 = '04042314bacas';
const id2 = 'lafdksaf92149123';
const reg1: ActiveRegistration = {
  _id: id1,
  creator: 'test',
  schemaVersion: '1.0',
  programId: 'ABCD-EF',
  batchName: 'registration1.tsv',
  stats: {
    alreadyRegistered: [],
    newDonorIds: [
      {
        submitterId: 'abcd123',
        rowNumbers: [0],
      },
    ],
    newSpecimenIds: [
      {
        submitterId: 'ss123',
        rowNumbers: [0],
      },
    ],
    newSampleIds: [
      {
        submitterId: 'sm123',
        rowNumbers: [0],
      },
    ],
  },
  records: [
    {
      program_id: 'ABCD-EF',
      submitter_donor_id: 'abcd123',
      gender: 'Male',
      submitter_specimen_id: 'ss123',
      specimen_tissue_source: 'Other',
      tumour_normal_designation: 'Normal',
      specimen_type: 'Normal',
      submitter_sample_id: 'sm123',
      sample_type: 'ctDNA',
    },
  ],
};

const reg2: ActiveRegistration = {
  _id: id2,
  creator: 'test',
  programId: 'ABCD-EF',
  batchName: 'registration2.tsv',
  schemaVersion: '1.0',
  stats: {
    alreadyRegistered: [],
    newDonorIds: [],
    newSpecimenIds: [
      {
        submitterId: 'ss123',
        rowNumbers: [0],
      },
    ],
    newSampleIds: [
      {
        submitterId: 'sm123',
        rowNumbers: [0],
      },
    ],
  },
  records: [
    {
      program_id: 'ABCD-EF',
      submitter_donor_id: 'abcd123',
      gender: 'Male',
      submitter_specimen_id: 'ss123',
      specimen_tissue_source: 'Other',
      tumour_normal_designation: 'Normal',
      specimen_type: 'Normal',
      submitter_sample_id: 'sm123',
      sample_type: 'ctDNA',
    },
  ],
};

describe('submission-to-clinical', () => {
  console.log('mocha is here');

  describe('commit registration', () => {
    let registrationRepoFindByIdStub: sinon.SinonStub<
      [string],
      Promise<deepFreeze.DeepReadonly<ActiveRegistration> | undefined>
    >;
    let findByProgramAndSubmitterIdStub: sinon.SinonStub<
      [
        readonly deepFreeze.DeepReadonly<
          deepFreeze.DeepReadonly<{
            programId: string;
            submitterId: string;
          }>
        >[],
      ],
      Promise<readonly deepFreeze.DeepReadonly<Donor>[] | undefined>
    >;
    let deleteRegStub: sinon.SinonStub<[string], Promise<void>>;
    let createDonorStub: sinon.SinonStub<
      [deepFreeze.DeepReadonly<Donor>],
      Promise<deepFreeze.DeepReadonly<Donor>>
    >;
    let updateDonorStub: sinon.SinonStub<
      [deepFreeze.DeepReadonly<Donor>],
      Promise<deepFreeze.DeepReadonly<Donor>>
    >;
    const sandBox = sinon.createSandbox();

    beforeEach(done => {
      // it's important to define stubs in scope otherwise mocha will excute them globally.
      registrationRepoFindByIdStub = sandBox.stub(registrationRepository, 'findById');
      findByProgramAndSubmitterIdStub = sandBox.stub(donorDao, 'findByProgramAndSubmitterId');
      deleteRegStub = sandBox.stub(registrationRepository, 'delete');
      createDonorStub = sandBox.stub(donorDao, 'create');
      updateDonorStub = sandBox.stub(donorDao, 'update');
      done();
    });

    afterEach(done => {
      sandBox.restore();
      done();
    });

    it('should create donor if not existing', async () => {
      const filter: FindByProgramAndSubmitterFilter = {
        submitterId: 'abcd123',
        programId: 'ABCD-EF',
      };

      const expectedDonorDto: Donor = {
        schemaMetadata: {
          isValid: true,
          lastValidSchemaVersion: '1.0',
          originalSchemaVersion: '1.0',
        },
        gender: 'Male',
        submitterId: 'abcd123',
        programId: 'ABCD-EF',
        specimens: [
          {
            samples: [
              {
                sampleType: 'ctDNA',
                submitterId: 'sm123',
              },
            ],
            clinicalInfo: {},
            specimenTissueSource: 'Other',
            tumourNormalDesignation: 'Normal',
            specimenType: 'Normal',
            submitterId: 'ss123',
          },
        ],
        clinicalInfo: {},
        primaryDiagnosis: undefined,
        followUps: [],
        treatments: [],
      };

      registrationRepoFindByIdStub.withArgs(id1).returns(Promise.resolve(reg1));
      findByProgramAndSubmitterIdStub.withArgs(sinon.match([filter])).returns(Promise.resolve([]));
      const result = await s2c.commitRegisteration({
        programId: reg1.programId,
        registrationId: reg1._id as string,
      });
      chai.expect(createDonorStub.calledOnceWith(sinon.match(expectedDonorDto))).to.eq(true);
      chai.expect(deleteRegStub.calledOnceWithExactly(id1)).to.eq(true);
    });

    it('should update donor if existing', async () => {
      const filter: FindByProgramAndSubmitterFilter = {
        submitterId: 'abcd123',
        programId: 'ABCD-EF',
      };

      const existingDonor: Donor = {
        schemaMetadata: {
          isValid: true,
          lastValidSchemaVersion: '1.0',
          originalSchemaVersion: '1.0',
        },
        _id: 'lkjsdal214',
        donorId: 3023,
        gender: 'Male',
        programId: 'ABCD-EF',
        submitterId: 'abcd123',
        specimens: [
          {
            specimenId: 320,
            specimenTissueSource: 'Other',
            submitterId: 'ss330',
            clinicalInfo: {},
            tumourNormalDesignation: 'Normal',
            specimenType: 'Normal',
            samples: [
              {
                sampleId: 39,
                sampleType: 'RNA',
                submitterId: 'sr342',
              },
            ],
          },
        ],
      };

      const expectedDonorDto: Donor = {
        schemaMetadata: {
          isValid: true,
          lastValidSchemaVersion: '1.0',
          originalSchemaVersion: '1.0',
        },
        _id: 'lkjsdal214',
        donorId: 3023,
        gender: 'Male',
        programId: 'ABCD-EF',
        submitterId: 'abcd123',
        specimens: [
          {
            specimenId: 320,
            specimenTissueSource: 'Other',
            submitterId: 'ss330',
            clinicalInfo: {},
            tumourNormalDesignation: 'Normal',
            specimenType: 'Normal',
            samples: [
              {
                sampleId: 39,
                sampleType: 'RNA',
                submitterId: 'sr342',
              },
            ],
          },
          {
            samples: [
              {
                sampleType: 'ctDNA',
                submitterId: 'sm123',
              },
            ],
            clinicalInfo: {},
            specimenTissueSource: 'Other',
            tumourNormalDesignation: 'Normal',
            specimenType: 'Normal',
            submitterId: 'ss123',
          },
        ],
      };

      registrationRepoFindByIdStub.withArgs(id2).returns(Promise.resolve(reg2));
      findByProgramAndSubmitterIdStub
        .withArgs(sinon.match([filter]))
        .returns(Promise.resolve([existingDonor]));
      const result = await s2c.commitRegisteration({
        programId: reg2.programId,
        registrationId: reg2._id as string,
      });
      chai.expect(updateDonorStub.calledOnceWith(sinon.match(expectedDonorDto))).to.eq(true);
      chai.expect(deleteRegStub.calledOnceWithExactly(id2)).to.eq(true);
    });
  });

  describe('stats-calculator', () => {
    const sandBox = sinon.createSandbox();
    // dummy stubs
    let donor: Donor;
    let treatment: ClinicalEntity;
    let followUp: ClinicalEntity;
    let coreFieldsStub: any = {};

    beforeEach(done => {
      coreFieldsStub = {
        [ClinicalEntitySchemaNames.DONOR]: { fields: ['donorField1', 'donorField2'] },
        [ClinicalEntitySchemaNames.FOLLOW_UP]: { fields: ['followUpField1'] },
        [ClinicalEntitySchemaNames.TREATMENT]: { fields: ['treatmentField1', 'treatmentField2'] },
      };

      // bare minimum schema manager stub to get core fields
      sandBox.stub(schemaManager, 'instance').value(() => {
        return {
          getSchemasWithFields: (schemaConstraint: any) => [coreFieldsStub[schemaConstraint.name]],
        };
      });

      donor = {
        schemaMetadata: {
          isValid: true,
          lastValidSchemaVersion: '1.0',
          originalSchemaVersion: '1.0',
        },
        _id: '22f23223f',
        submitterId: 'AB2',
        programId: 'PEME-CA',
        donorId: 20,
        clinicalInfo: {},
        gender: 'Female',
        specimens: [],
        followUps: [{ clinicalInfo: {} }],
        treatments: [{ clinicalInfo: {}, therapies: [] }],
        aggregatedInfoStats: {
          submittedCoreFields: 0,
          expectedCoreFields: 0,
          submittedExtendedFields: 0,
          expectedExtendedFields: 0,
        },
      };
      followUp = (donor.followUps || [])[0];
      treatment = (donor.treatments || [])[0];

      done();
    });

    afterEach(done => {
      sandBox.restore();
      done();
    });

    it('should calculate stats correctly when changing clinical entity info', () => {
      chai.expect(donor.aggregatedInfoStats).to.deep.eq({
        submittedCoreFields: 0,
        expectedCoreFields: 0,
        submittedExtendedFields: 0,
        expectedExtendedFields: 0,
      });
      donor.clinicalInfo = { donorField1: 1, donorField2: 2 }; // expected 2; submitted 2
      updateClinicalStatsAndDonorStats(donor, donor, ClinicalEntitySchemaNames.DONOR);

      followUp.clinicalInfo = { followUpField1: 0 }; // expected 1; submitted 1
      updateClinicalStatsAndDonorStats(followUp, donor, ClinicalEntitySchemaNames.FOLLOW_UP);

      treatment.clinicalInfo = { treatmentField1: 0 }; // expected 2; submitted 1
      updateClinicalStatsAndDonorStats(treatment, donor, ClinicalEntitySchemaNames.TREATMENT);

      chai.expect(donor.aggregatedInfoStats).to.deep.include({
        submittedCoreFields: 4,
        expectedCoreFields: 5,
      });

      // remove a field
      donor.clinicalInfo = { donorField1: 1, donorField2: undefined }; // expected 2; submitted 1 (undefined is ingnored)
      updateClinicalStatsAndDonorStats(donor, donor, ClinicalEntitySchemaNames.DONOR);

      chai.expect(donor.aggregatedInfoStats).to.deep.include({
        submittedCoreFields: 3,
        expectedCoreFields: 5,
      });
    });

    it('should calculate stats correctly when changing core fields', () => {
      chai.expect(donor.aggregatedInfoStats).to.deep.eq({
        submittedCoreFields: 0,
        expectedCoreFields: 0,
        submittedExtendedFields: 0,
        expectedExtendedFields: 0,
      });
      donor.clinicalInfo = { donorField1: 1, donorField2: 2 }; // expected 2; submitted 2
      updateClinicalStatsAndDonorStats(donor, donor, ClinicalEntitySchemaNames.DONOR);

      treatment.clinicalInfo = { treatmentField1: 0 }; // expected 2; submitted 1
      updateClinicalStatsAndDonorStats(treatment, donor, ClinicalEntitySchemaNames.TREATMENT);

      chai.expect(donor.aggregatedInfoStats).to.deep.include({
        submittedCoreFields: 3,
        expectedCoreFields: 4,
      });

      // remove a core field in treatment (assume its optional field so donor remains valid )
      coreFieldsStub[ClinicalEntitySchemaNames.TREATMENT].fields.pop();
      updateClinicalStatsAndDonorStats(treatment, donor, ClinicalEntitySchemaNames.TREATMENT);
      chai.expect(donor.aggregatedInfoStats).to.deep.include({
        submittedCoreFields: 3,
        expectedCoreFields: 3,
      });

      // add a new core field to donor
      coreFieldsStub[ClinicalEntitySchemaNames.DONOR].fields.push('donorField3');
      updateClinicalStatsAndDonorStats(donor, donor, ClinicalEntitySchemaNames.DONOR);
      chai.expect(donor.aggregatedInfoStats).to.deep.include({
        submittedCoreFields: 3,
        expectedCoreFields: 4,
      });
    });

    it('should calculate stats correctly when changing clinical entity info & core fields', () => {
      chai.expect(donor.aggregatedInfoStats).to.deep.eq({
        submittedCoreFields: 0,
        expectedCoreFields: 0,
        submittedExtendedFields: 0,
        expectedExtendedFields: 0,
      });

      donor.clinicalInfo = { donorField1: '1', donorField2: 'asdf' }; // expected 2; submitted 2
      updateClinicalStatsAndDonorStats(donor, donor, ClinicalEntitySchemaNames.DONOR);

      treatment.clinicalInfo = { treatmentField1: 0 }; // expected 2; submitted 1
      updateClinicalStatsAndDonorStats(treatment, donor, ClinicalEntitySchemaNames.TREATMENT);

      chai.expect(donor.aggregatedInfoStats).to.deep.include({
        submittedCoreFields: 3,
        expectedCoreFields: 4,
      });

      // remove a core field in treatment (assume its an optional field so donor remains valid )
      coreFieldsStub[ClinicalEntitySchemaNames.TREATMENT].fields.pop();
      updateClinicalStatsAndDonorStats(treatment, donor, ClinicalEntitySchemaNames.TREATMENT);
      chai.expect(donor.aggregatedInfoStats).to.deep.include({
        submittedCoreFields: 3,
        expectedCoreFields: 3,
      });

      // remove field value in donor clincialInfo
      donor.clinicalInfo = { donorField1: 1, donorField2: undefined }; // expected 2; submitted 1 (undefined should be ignored)
      updateClinicalStatsAndDonorStats(donor, donor, ClinicalEntitySchemaNames.DONOR);
      chai.expect(donor.aggregatedInfoStats).to.deep.include({
        submittedCoreFields: 2,
        expectedCoreFields: 3,
      });

      // add new core field in donor
      coreFieldsStub[ClinicalEntitySchemaNames.DONOR].fields.push('donorField3');
      updateClinicalStatsAndDonorStats(donor, donor, ClinicalEntitySchemaNames.DONOR);
      chai.expect(donor.aggregatedInfoStats).to.deep.include({
        submittedCoreFields: 2,
        expectedCoreFields: 4,
      });
    });
  });
});
