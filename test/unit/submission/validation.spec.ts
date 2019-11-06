import chai from 'chai';
import sinon from 'sinon';
import { donorDao } from '../../../src/clinical/donor-repo';
import * as dv from '../../../src/submission/validation';
import {
  SubmissionValidationError,
  DataValidationErrors,
  CreateRegistrationRecord,
  FieldsEnum,
  ClinicalInfoFieldsEnum,
  ClinicalEntityType,
} from '../../../src/submission/submission-entities';
import { Donor } from '../../../src/clinical/clinical-entities';
import { stubs } from './stubs';

const genderMutatedErr: SubmissionValidationError = {
  fieldName: 'gender',
  index: 0,
  info: {
    donorSubmitterId: 'AB1',
    sampleSubmitterId: 'AM1',
    specimenSubmitterId: 'SP1',
    value: 'Male',
    originalValue: 'Female',
  },
  message:
    'The value does not match the previously registered value of Female. Please correct your file or contact DCC to update the registered data.',
  type: DataValidationErrors.MUTATING_EXISTING_DATA,
};
const programInvalidErr: SubmissionValidationError = {
  fieldName: FieldsEnum.program_id,
  index: 0,
  info: {
    expectedProgram: 'PEME-CA',
    donorSubmitterId: 'AB1',
    specimenSubmitterId: 'SP1',
    sampleSubmitterId: 'AM1',
    value: 'PEM-CA',
  },
  message:
    'Program ID does not match. Please include the correct Program ID.',
  type: DataValidationErrors.INVALID_PROGRAM_ID,
};
const specimenMutatedErr: SubmissionValidationError = {
  fieldName: FieldsEnum.specimen_tissue_source,
  index: 0,
  info: {
    originalValue: 'XYZ',
    donorSubmitterId: 'AB1',
    specimenSubmitterId: 'SP1',
    sampleSubmitterId: 'AM1',
    value: 'XYZ1',
  },
  message:
    'The value does not match the previously registered value of XYZ. Please correct your file or contact DCC to update the registered data.',
  type: DataValidationErrors.MUTATING_EXISTING_DATA,
};
const tndError: SubmissionValidationError = {
  fieldName: FieldsEnum.tumour_normal_designation,
  index: 0,
  info: {
    donorSubmitterId: 'AB1',
    specimenSubmitterId: 'SP1',
    sampleSubmitterId: 'AM1',
    value: 'Normal2',
    originalValue: 'Normal',
  },
  message:
    'The value does not match the previously registered value of Normal. Please correct your file or contact DCC to update the registered data.',
  type: DataValidationErrors.MUTATING_EXISTING_DATA,
};

const sampleTypeMutatedError: SubmissionValidationError = {
  fieldName: FieldsEnum.sample_type,
  index: 0,
  info: {
    donorSubmitterId: 'AB1',
    specimenSubmitterId: 'SP1',
    sampleSubmitterId: 'AM1',
    value: 'ST11',
    originalValue: 'ST1',
  },
  message:
    'The value does not match the previously registered value of ST1. Please correct your file or contact DCC to update the registered data.',
  type: DataValidationErrors.MUTATING_EXISTING_DATA,
};

const specimenBelongsToOtherDonor: SubmissionValidationError = {
  fieldName: FieldsEnum.submitter_specimen_id,
  index: 0,
  info: {
    donorSubmitterId: 'AB2',
    specimenSubmitterId: 'SP1',
    sampleSubmitterId: 'AM1',
    value: 'SP1',
    otherDonorSubmitterId: 'AB1',
  },
  message:
    'Specimens can only be registered to a single donor. This specimen has already been registered to donor AB1. Please correct your file or contact DCC to update the registered data.',
  type: DataValidationErrors.SPECIMEN_BELONGS_TO_OTHER_DONOR,
};

const sampleBelongsToOtherSpecimenAB2: SubmissionValidationError = {
  fieldName: FieldsEnum.submitter_sample_id,
  index: 0,
  info: {
    donorSubmitterId: 'AB2',
    specimenSubmitterId: 'SP2',
    sampleSubmitterId: 'AM1',
    value: 'AM1',
    otherSpecimenSubmitterId: 'SP1',
  },
  message:
    'Samples can only be registered to a single specimen. This sample has already been registered to specimen SP1. Please correct your file or contact DCC to update the registered data.',
  type: DataValidationErrors.SAMPLE_BELONGS_TO_OTHER_SPECIMEN,
};

const sampleBelongsToOtherSpecimenAB1: SubmissionValidationError = {
  fieldName: FieldsEnum.submitter_sample_id,
  index: 0,
  info: {
    donorSubmitterId: 'AB1',
    specimenSubmitterId: 'SP2',
    sampleSubmitterId: 'AM1',
    value: 'AM1',
    otherSpecimenSubmitterId: 'SP1',
  },
  message:
    'Samples can only be registered to a single specimen. This sample has already been registered to specimen SP1. Please correct your file or contact DCC to update the registered data.',
  type: DataValidationErrors.SAMPLE_BELONGS_TO_OTHER_SPECIMEN,
};

describe('data-validator', () => {
  let donorDaoCountByStub: sinon.SinonStub;
  let donorDaoFindBySpecimenSubmitterIdAndProgramIdStub: sinon.SinonStub;
  let donorDaoFindBySampleSubmitterIdAndProgramIdStub: sinon.SinonStub;
  beforeEach(done => {
    donorDaoCountByStub = sinon.stub(donorDao, 'countBy');
    donorDaoFindBySpecimenSubmitterIdAndProgramIdStub = sinon.stub(
      donorDao,
      'findBySpecimenSubmitterIdAndProgramId',
    );
    donorDaoFindBySampleSubmitterIdAndProgramIdStub = sinon.stub(
      donorDao,
      'findBySampleSubmitterIdAndProgramId',
    );
    done();
  });

  afterEach(done => {
    donorDaoCountByStub.restore();
    donorDaoFindBySpecimenSubmitterIdAndProgramIdStub.restore();
    donorDaoFindBySampleSubmitterIdAndProgramIdStub.restore();
    done();
  });
  describe('registration-validation', () => {
    it('should detect invalid program id', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      // test call
      const result = await dv.usingInvalidProgramId(
        ClinicalEntityType.REGISTRATION,
        0,
        {
          [FieldsEnum.submitter_donor_id]: 'AB1',
          [FieldsEnum.gender]: 'Male',
          [FieldsEnum.program_id]: 'PEM-CA',
          [FieldsEnum.submitter_sample_id]: 'AM1',
          [FieldsEnum.specimen_tissue_source]: 'XYZ',
          [FieldsEnum.sample_type]: 'ST1',
          [FieldsEnum.submitter_specimen_id]: 'SP1',
          [FieldsEnum.tumour_normal_designation]: 'Normal',
        },
        'PEME-CA',
      );

      // assertions
      chai.expect(result.length).to.eq(1);
      chai.expect(result[0]).to.deep.eq(programInvalidErr);
    });

    it('should detect gender update', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      const existingDonorMock: Donor = stubs.validation.existingDonor01();

      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST1',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
        ],
        { AB1: existingDonorMock },
      );

      // assertions
      chai.expect(result.errors.length).to.eq(1);
      chai.expect(result.errors[0]).to.deep.eq(genderMutatedErr);
    });

    it('should detect specimen type update', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      const existingDonorMock: Donor = stubs.validation.existingDonor01();

      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Female',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ1',
            sampleType: 'ST1',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
        ],
        { AB1: existingDonorMock },
      );

      // assertions
      chai.expect(result.errors.length).to.eq(1);
      chai.expect(result.errors[0]).to.deep.eq(specimenMutatedErr);
    });

    it('should detect tumourNormalDesignation update', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      const existingDonorMock: Donor = stubs.validation.existingDonor01();

      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Female',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST1',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal2',
          },
        ],
        { AB1: existingDonorMock },
      );

      // assertions
      chai.expect(result.errors.length).to.eq(1);
      chai.expect(result.errors[0]).to.deep.eq(tndError);
    });

    it('should detect sampleType update', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      const existingDonorMock: Donor = stubs.validation.existingDonor01();

      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Female',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
        ],
        { AB1: existingDonorMock },
      );

      // assertions
      chai.expect(result.errors.length).to.eq(1);
      chai.expect(result.errors[0]).to.deep.eq(sampleTypeMutatedError);
    });

    it('should detect sampleType, specimenTissueSource,tnd, gender update togather', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      const existingDonorMock: Donor = stubs.validation.existingDonor01();
      const valid2ndRecord: CreateRegistrationRecord = {
        donorSubmitterId: 'AB11',
        gender: 'Male',
        programId: 'PEME-CA',
        sampleSubmitterId: 'AM13',
        specimenTissueSource: 'XYZ1',
        sampleType: 'S',
        specimenSubmitterId: 'RR',
        tumourNormalDesignation: 'Normal',
      };
      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEM-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZQ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal2',
          },
          valid2ndRecord,
        ],
        { AB1: existingDonorMock },
      );

      // assertions
      chai.expect(result.errors.length).to.eq(4);
      chai.expect(result.errors).to.deep.include(sampleTypeMutatedError);
      const specimenMutatedError: SubmissionValidationError = {
        fieldName: FieldsEnum.specimen_tissue_source,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          specimenSubmitterId: 'SP1',
          sampleSubmitterId: 'AM1',
          value: 'XYZQ',
          originalValue: 'XYZ',
        },
        message:
          'The value does not match the previously registered value of XYZ. Please correct your file or contact DCC to update the registered data.',
        type: DataValidationErrors.MUTATING_EXISTING_DATA,
      };
      chai.expect(result.errors).to.deep.include(specimenMutatedError);
      chai.expect(result.errors).to.deep.include(tndError);
      chai.expect(result.errors).to.deep.include(genderMutatedErr);
    });

    it('should detect specimen belongs to other donor', async () => {
      donorDaoFindBySpecimenSubmitterIdAndProgramIdStub.returns(
        Promise.resolve<Donor>(stubs.validation.existingDonor02()),
      );
      donorDaoFindBySampleSubmitterIdAndProgramIdStub.returns(
        Promise.resolve<Donor>(stubs.validation.existingDonor02()),
      );

      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB2',
            gender: 'Female',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
        ],
        {},
      );

      // assertions
      chai.expect(result.errors.length).to.eq(2);
      chai.expect(result.errors).to.deep.include(specimenBelongsToOtherDonor);
    });

    // see issue https://github.com/icgc-argo/argo-clinical/issues/112
    it('should detect specimen belongs to other donor and specimen type changed', async () => {
      donorDaoFindBySampleSubmitterIdAndProgramIdStub.returns(
        Promise.resolve(stubs.validation.existingDonor02()),
      );

      donorDaoFindBySpecimenSubmitterIdAndProgramIdStub.returns(
        Promise.resolve<Donor>(stubs.validation.existingDonor02()),
      );

      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB2',
            gender: 'Female',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
        ],
        {},
      );

      const specimenTypeMutatedErr: SubmissionValidationError = {
        fieldName: FieldsEnum.specimen_tissue_source,
        index: 0,
        info: {
          donorSubmitterId: 'AB2',
          specimenSubmitterId: 'SP1',
          sampleSubmitterId: 'AM1',
          value: 'XYZ',
          originalValue: 'XYZZ',
        },
        message:
          'The value does not match the previously registered value of XYZZ. Please correct your file or contact DCC to update the registered data.',
        type: DataValidationErrors.MUTATING_EXISTING_DATA,
      };

      // assertions
      chai.expect(result.errors.length).to.eq(2);
      chai.expect(result.errors[0]).to.deep.include(specimenTypeMutatedErr);
      chai.expect(result.errors[1]).to.deep.include(specimenBelongsToOtherDonor);
    });

    it('should detect sample belongs to other specimen, same donor', async () => {
      donorDaoFindBySpecimenSubmitterIdAndProgramIdStub.returns(
        Promise.resolve<Donor>(stubs.validation.existingDonor02()),
      );
      donorDaoFindBySampleSubmitterIdAndProgramIdStub.returns(
        Promise.resolve<Donor>(stubs.validation.existingDonor02()),
      );
      const existingDonorMock: Donor = stubs.validation.existingDonor01();
      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Female',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP2',
            tumourNormalDesignation: 'Normal',
          },
        ],
        { AB1: existingDonorMock },
      );

      // assertions
      chai.expect(result.errors.length).to.eq(1);
      chai.expect(result.errors[0]).to.deep.eq(sampleBelongsToOtherSpecimenAB1);
    });

    it('should detect sample belongs to other specimen, different donor', async () => {
      donorDaoFindBySpecimenSubmitterIdAndProgramIdStub.returns(
        Promise.resolve<Donor>(stubs.validation.existingDonor02()),
      );
      donorDaoFindBySampleSubmitterIdAndProgramIdStub.returns(
        Promise.resolve<Donor>(stubs.validation.existingDonor02()),
      );
      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB2',
            gender: 'Female',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP2',
            tumourNormalDesignation: 'Normal',
          },
        ],
        {},
      );

      // assertions
      chai.expect(result.errors.length).to.eq(2);
      chai.expect(result.errors).to.deep.include(sampleBelongsToOtherSpecimenAB2);
    });

    // different donor different specimen same sample id
    it('should detect sample id conflict between new registrations', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP2',
            tumourNormalDesignation: 'Normal',
          },
          {
            donorSubmitterId: 'AB2',
            gender: 'Female',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
        ],
        {},
      );

      // assertions
      const row0Err = {
        fieldName: FieldsEnum.submitter_sample_id,
        index: 0,
        info: {
          conflictingRows: [1],
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP2',
          value: 'AM1',
        },
        type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT,
        message:
          'You are trying to register the same sample either with multiple donors, specimens or rows. Samples can only be registered once to a single donor and specimen.',
      };

      const row1Err = {
        fieldName: FieldsEnum.submitter_sample_id,
        index: 1,
        info: {
          conflictingRows: [0],
          donorSubmitterId: 'AB2',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'AM1',
        },
        message:
          'You are trying to register the same sample either with multiple donors, specimens or rows. Samples can only be registered once to a single donor and specimen.',
        type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT,
      };

      chai.expect(result.errors.length).to.eq(2);
      chai.expect(result.errors).to.deep.include(row0Err);
      chai.expect(result.errors).to.deep.include(row1Err);
    });

    // different donors & samples same specimen Id
    it('should detect specimen conflict between new registrations', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
          // dummy ok row to make sure indexes detected correctly
          {
            donorSubmitterId: 'AB3',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM4',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP4',
            tumourNormalDesignation: 'Normal',
          },
          {
            donorSubmitterId: 'AB2',
            gender: 'Female',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM2',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
        ],
        {},
      );

      // assertions
      const row0Err = {
        fieldName: FieldsEnum.submitter_specimen_id,
        index: 0,
        info: {
          conflictingRows: [2],
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'SP1',
        },
        message:
          'You are trying to register the same sample to multiple donors. Specimens can only be registered to a single donor.',
        type: DataValidationErrors.NEW_SPECIMEN_ID_CONFLICT,
      };

      const row2Err = {
        fieldName: FieldsEnum.submitter_specimen_id,
        index: 2,
        info: {
          conflictingRows: [0],
          donorSubmitterId: 'AB2',
          sampleSubmitterId: 'AM2',
          specimenSubmitterId: 'SP1',
          value: 'SP1',
        },
        message:
          'You are trying to register the same sample to multiple donors. Specimens can only be registered to a single donor.',
        type: DataValidationErrors.NEW_SPECIMEN_ID_CONFLICT,
      };

      chai.expect(result.errors.length).to.eq(2);
      chai.expect(result.errors).to.deep.include(row0Err);
      chai.expect(result.errors).to.deep.include(row2Err);
    });

    // same donor same specimen different specimen type
    it('should detect specimen type conflict for same new donor', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYX',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
          // dummy ok row to make sure indexes detected correctly
          {
            donorSubmitterId: 'AB3',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM4',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP4',
            tumourNormalDesignation: 'Normal',
          },
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM2',
            specimenTissueSource: 'XYz',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
        ],
        {},
      );

      // assertions
      const row0Err: SubmissionValidationError = {
        fieldName: FieldsEnum.specimen_tissue_source,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'XYX',
          conflictingRows: [2],
        },
        message: 'You are trying to register the same specimen with different values.',
        type: DataValidationErrors.NEW_SPECIMEN_ATTR_CONFLICT,
      };

      const row2Err: SubmissionValidationError = {
        fieldName: FieldsEnum.specimen_tissue_source,
        index: 2,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM2',
          specimenSubmitterId: 'SP1',
          value: 'XYz',
          conflictingRows: [0],
        },
        message: 'You are trying to register the same specimen with different values.',
        type: DataValidationErrors.NEW_SPECIMEN_ATTR_CONFLICT,
      };

      chai.expect(result.errors.length).to.eq(2);
      chai.expect(result.errors).to.deep.include(row0Err);
      chai.expect(result.errors).to.deep.include(row2Err);
    });

    // same donor same specimen different specimen type
    it('should detect sample type conflict for same new specimen & sample Id', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST-2',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
          // dummy ok row to make sure indexes detected correctly
          {
            donorSubmitterId: 'AB3',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM4',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP4',
            tumourNormalDesignation: 'Normal',
          },
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST2',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
        ],
        {},
      );

      // assertions
      const row0Err: SubmissionValidationError = {
        fieldName: FieldsEnum.sample_type,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'ST-2',
          conflictingRows: [2],
        },
        message: 'You are trying to register the same sample with different sample types.',
        type: DataValidationErrors.NEW_SAMPLE_ATTR_CONFLICT,
      };

      const row2Err: SubmissionValidationError = {
        fieldName: FieldsEnum.sample_type,
        index: 2,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'ST2',
          conflictingRows: [0],
        },
        message: 'You are trying to register the same sample with different sample types.',
        type: DataValidationErrors.NEW_SAMPLE_ATTR_CONFLICT,
      };

      chai.expect(result.errors.length).to.eq(2);
      chai.expect(result.errors).to.deep.include(row0Err);
      chai.expect(result.errors).to.deep.include(row2Err);
    });

    it('should detect gender conflict in new donors', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST-2',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
          // dummy ok row to make sure indexes detected correctly
          {
            donorSubmitterId: 'AB3',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM4',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP4',
            tumourNormalDesignation: 'Normal',
          },
          {
            donorSubmitterId: 'AB1',
            gender: 'Female',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM2',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST-2',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
        ],
        {},
      );

      // assertions
      const row0Err: SubmissionValidationError = {
        fieldName: FieldsEnum.gender,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'Male',
          conflictingRows: [2],
        },
        message: 'You are trying to register the same donor twice with different genders.',
        type: DataValidationErrors.NEW_DONOR_CONFLICT,
      };

      const row2Err: SubmissionValidationError = {
        fieldName: FieldsEnum.gender,
        index: 2,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM2',
          specimenSubmitterId: 'SP1',
          value: 'Female',
          conflictingRows: [0],
        },
        message: 'You are trying to register the same donor twice with different genders.',
        type: DataValidationErrors.NEW_DONOR_CONFLICT,
      };

      chai.expect(result.errors.length).to.eq(2);
      chai.expect(result.errors).to.deep.include(row0Err);
      chai.expect(result.errors).to.deep.include(row2Err);
    });

    it('should detect sample id conflict for same donor & different specimen Id', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Female',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST2',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
          // dummy ok row to make sure indexes detected correctly
          {
            donorSubmitterId: 'AB3',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM4',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP4',
            tumourNormalDesignation: 'Normal',
          },
          {
            donorSubmitterId: 'AB1',
            gender: 'Female',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST2',
            specimenSubmitterId: 'SP2',
            tumourNormalDesignation: 'Normal',
          },
        ],
        {},
      );

      // assertions
      const row0Err: SubmissionValidationError = {
        fieldName: FieldsEnum.submitter_sample_id,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'AM1',
          conflictingRows: [2],
        },
        message:
          'You are trying to register the same sample either with multiple donors, specimens or rows. Samples can only be registered once to a single donor and specimen.',
        type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT,
      };

      const row2Err: SubmissionValidationError = {
        fieldName: FieldsEnum.submitter_sample_id,
        index: 2,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP2',
          value: 'AM1',
          conflictingRows: [0],
        },
        message:
          'You are trying to register the same sample either with multiple donors, specimens or rows. Samples can only be registered once to a single donor and specimen.',
        type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT,
      };

      chai.expect(result.errors.length).to.eq(2);
      chai.expect(result.errors).to.deep.include(row0Err);
      chai.expect(result.errors).to.deep.include(row2Err);
    });

    it('should detect sample type conflict for same new specimen & sample Id', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      // test call
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST-2',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
          // dummy ok row to make sure indexes detected correctly
          {
            donorSubmitterId: 'AB3',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM4',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP4',
            tumourNormalDesignation: 'Normal',
          },
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST2',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
        ],
        {},
      );

      // assertions
      const row0Err: SubmissionValidationError = {
        fieldName: FieldsEnum.sample_type,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'ST-2',
          conflictingRows: [2],
        },
        message: 'You are trying to register the same sample with different sample types.',
        type: DataValidationErrors.NEW_SAMPLE_ATTR_CONFLICT,
      };

      const row2Err = {
        fieldName: FieldsEnum.sample_type,
        index: 2,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'ST2',
          conflictingRows: [0],
        },
        message: 'You are trying to register the same sample with different sample types.',
        type: DataValidationErrors.NEW_SAMPLE_ATTR_CONFLICT,
      };

      chai.expect(result.errors.length).to.eq(2);
      chai.expect(result.errors).to.deep.include(row0Err);
      chai.expect(result.errors).to.deep.include(row2Err);
    });

    // records with same donor, specimen & sample submitter_id
    it('should detect duplicate registration records', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      const result = await dv.validateRegistrationData(
        'PEME-CA',
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST-2',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST-2',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST-2',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
          },
        ],
        {},
      );

      // assertions
      const row0Err: SubmissionValidationError = {
        fieldName: FieldsEnum.submitter_sample_id,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'AM1',
          conflictingRows: [1, 2],
        },
        message:
          'You are trying to register the same sample either with multiple donors, specimens or rows. Samples can only be registered once to a single donor and specimen.',
        type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT,
      };
      const row1Err = {
        fieldName: FieldsEnum.submitter_sample_id,
        index: 1,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'AM1',
          conflictingRows: [0, 2],
        },
        message:
          'You are trying to register the same sample either with multiple donors, specimens or rows. Samples can only be registered once to a single donor and specimen.',
        type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT,
      };
      const row2Err = {
        fieldName: FieldsEnum.submitter_sample_id,
        index: 2,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'AM1',
          conflictingRows: [0, 1],
        },
        message:
          'You are trying to register the same sample either with multiple donors, specimens or rows. Samples can only be registered once to a single donor and specimen.',
        type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT,
      };

      chai.expect(result.errors.length).to.eq(3);
      chai.expect(result.errors[0]).to.deep.eq(row0Err);
      chai.expect(result.errors[1]).to.deep.eq(row1Err);
      chai.expect(result.errors[2]).to.deep.eq(row2Err);
    });
  });

  describe('submission-validations', () => {
    it('should validate donor and specimen ids for specimen submissions', async () => {
      const existingDonorMock: Donor = stubs.validation.existingDonor01();
      const result = await dv.validateSubmissionData(
        {
          AB1: {
            specimen: {
              [FieldsEnum.submitter_donor_id]: 'AB1',
              [FieldsEnum.program_id]: 'ABCD-EF',
              [FieldsEnum.submitter_specimen_id]: 'SP2',
              index: 0,
            },
          },
          AB2: {
            specimen: {
              [FieldsEnum.submitter_donor_id]: 'AB2',
              [FieldsEnum.program_id]: 'ABCD-EF',
              [FieldsEnum.submitter_specimen_id]: 'SP1',
              index: 1,
            },
          },
        },
        { AB1: existingDonorMock },
      );
      const specimenIdErr: SubmissionValidationError = {
        fieldName: FieldsEnum.submitter_specimen_id,
        message: `SP2 has not yet been registered. Please register here before submitting clinical data for this identifier.`,
        type: DataValidationErrors.ID_NOT_REGISTERED,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          value: 'SP2',
        },
      };
      const donorIdErr: SubmissionValidationError = {
        fieldName: FieldsEnum.submitter_donor_id,
        message:
          'AB2 has not yet been registered. Please register here before submitting clinical data for this identifier.',
        type: DataValidationErrors.ID_NOT_REGISTERED,
        index: 1,
        info: {
          donorSubmitterId: 'AB2',
          value: 'AB2',
        },
      };

      chai.expect(result.specimen.dataErrors.length).to.eq(2);
      chai.expect(result.specimen.dataErrors[0]).to.deep.eq(specimenIdErr);
      chai.expect(result.specimen.dataErrors[1]).to.deep.eq(donorIdErr);
    });
    it('should validate time intervals between donor and specimen', async () => {
      const existingDonorMock1: Donor = stubs.validation.existingDonor04();
      const existingDonorMock2: Donor = stubs.validation.existingDonor03();

      // AB2 is where only specimen is being uploaded and donor already has clinicalInfo
      // AB3 is when donor and specimen are being updated
      const errors = await dv.validateSubmissionData(
        {
          AB2: {
            specimen: {
              [FieldsEnum.submitter_donor_id]: 'AB2',
              [FieldsEnum.program_id]: 'PEME-CA',
              [FieldsEnum.submitter_specimen_id]: 'SP13',
              [ClinicalInfoFieldsEnum.acquisition_interval]: '5020',
              index: 1,
            },
          },
          AB3: {
            specimen: {
              [FieldsEnum.submitter_donor_id]: 'AB3',
              [FieldsEnum.program_id]: 'PEME-CA',
              [FieldsEnum.submitter_specimen_id]: 'SP12',
              [ClinicalInfoFieldsEnum.acquisition_interval]: '2000',
              index: 2,
            },
            donor: {
              [FieldsEnum.submitter_donor_id]: 'AB3',
              [FieldsEnum.program_id]: 'PEME-CA',
              [ClinicalInfoFieldsEnum.vital_status]: 'deceased',
              [ClinicalInfoFieldsEnum.survival_time]: '522',
              index: 1,
            },
          },
        },
        { AB2: existingDonorMock1, AB3: existingDonorMock2 },
      );
      const specimenIntervalErr: SubmissionValidationError = {
        fieldName: ClinicalInfoFieldsEnum.acquisition_interval,
        message: 'survival_time cannot be less than Specimen acquisition_interval.',
        type: DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        index: 1,
        info: {
          donorSubmitterId: 'AB2',
          value: '5020',
        },
      };
      const specimenIntervalErr2: SubmissionValidationError = {
        fieldName: ClinicalInfoFieldsEnum.acquisition_interval,
        message: 'survival_time cannot be less than Specimen acquisition_interval.',
        type: DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        index: 2,
        info: {
          donorSubmitterId: 'AB3',
          value: '2000',
        },
      };
      const donorSurvivalTimeErr: SubmissionValidationError = {
        fieldName: ClinicalInfoFieldsEnum.survival_time,
        message: 'survival_time cannot be less than Specimen acquisition_interval.',
        type: DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        index: 1,
        info: {
          conflictingSpecimenSubmitterIds: ['SP12'],
          donorSubmitterId: 'AB3',
          value: '522',
        },
      };

      chai.expect(errors.specimen.dataErrors.length).to.eq(2);
      chai.expect(errors.specimen.dataErrors[0]).to.deep.eq(specimenIntervalErr);
      chai.expect(errors.specimen.dataErrors[1]).to.deep.eq(specimenIntervalErr2);
      chai.expect(errors.donor.dataErrors.length).to.eq(1);
      chai.expect(errors.donor.dataErrors[0]).to.deep.eq(donorSurvivalTimeErr);
    });
  });
});
