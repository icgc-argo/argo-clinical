import chai from 'chai';
import sinon from 'sinon';
import { donorDao } from '../../../src/clinical/donor-repo';
import * as dv from '../../../src/submission/validation-clinical/validation';
import {
  SubmissionValidationError,
  DataValidationErrors,
  CreateRegistrationRecord,
  SampleRegistrationFieldsEnum,
  ClinicalEntitySchemaNames,
  SpecimenFieldsEnum,
  DonorFieldsEnum,
  TreatmentFieldsEnum,
  FollowupFieldsEnum,
  ClinicalUniqueIndentifier,
} from '../../../src/submission/submission-entities';
import { Donor } from '../../../src/clinical/clinical-entities';
import { stubs } from './stubs';
import { fail } from 'assert';
import {
  ClinicalSubmissionRecordsOperations,
  usingInvalidProgramId,
} from '../../../src/submission/validation-clinical/utils';

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
  fieldName: SampleRegistrationFieldsEnum.program_id,
  index: 0,
  info: {
    expectedProgram: 'PEME-CA',
    donorSubmitterId: 'AB1',
    specimenSubmitterId: 'SP1',
    sampleSubmitterId: 'AM1',
    value: 'PEM-CA',
  },
  message: 'Program ID does not match. Please include the correct Program ID.',
  type: DataValidationErrors.INVALID_PROGRAM_ID,
};
const specimenMutatedErr: SubmissionValidationError = {
  fieldName: SampleRegistrationFieldsEnum.specimen_tissue_source,
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
  fieldName: SampleRegistrationFieldsEnum.tumour_normal_designation,
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
  fieldName: SampleRegistrationFieldsEnum.sample_type,
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
  fieldName: SampleRegistrationFieldsEnum.submitter_specimen_id,
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
  fieldName: SampleRegistrationFieldsEnum.submitter_sample_id,
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
  fieldName: SampleRegistrationFieldsEnum.submitter_sample_id,
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

const VALUE_ALREADY_REGISTERED_MSG =
  'The value does not match the previously registered value of XYZZ. Please correct your file or contact DCC to update the registered data.';
const NEW_SAMPLE_ID_CONFLICT =
  'You are trying to register the same sample either with multiple donors, specimens or rows. Samples can only be registered once to a single donor and specimen.';
const NEW_SPEC_ATTR_CONFLICT =
  'You are trying to register the same specimen with different values.';

describe('data-validator', () => {
  let donorDaoCountByStub: sinon.SinonStub;
  let donorDaoFindBySpecimenSubmitterIdAndProgramIdStub: sinon.SinonStub;
  let donorDaoFindBySampleSubmitterIdAndProgramIdStub: sinon.SinonStub;
  let donorDaoFindByFollowUpSubmitterIdAndProgramIdStub: sinon.SinonStub;
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

    donorDaoFindByFollowUpSubmitterIdAndProgramIdStub = sinon.stub(
      donorDao,
      'findByFollowUpSubmitterIdAndProgramId',
    );
    done();
  });

  afterEach(done => {
    donorDaoCountByStub.restore();
    donorDaoFindBySpecimenSubmitterIdAndProgramIdStub.restore();
    donorDaoFindBySampleSubmitterIdAndProgramIdStub.restore();
    donorDaoFindByFollowUpSubmitterIdAndProgramIdStub.restore();
    done();
  });
  describe('registration-validation', () => {
    it('should detect invalid program id', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      // test call
      const result = await usingInvalidProgramId(
        ClinicalEntitySchemaNames.REGISTRATION,
        0,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [SampleRegistrationFieldsEnum.gender]: 'Male',
          [SampleRegistrationFieldsEnum.program_id]: 'PEM-CA',
          [SampleRegistrationFieldsEnum.submitter_sample_id]: 'AM1',
          [SampleRegistrationFieldsEnum.specimen_tissue_source]: 'XYZ',
          [SampleRegistrationFieldsEnum.sample_type]: 'ST1',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP1',
          [SampleRegistrationFieldsEnum.tumour_normal_designation]: 'Normal',
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
        fieldName: SampleRegistrationFieldsEnum.specimen_tissue_source,
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
        fieldName: SampleRegistrationFieldsEnum.specimen_tissue_source,
        index: 0,
        info: {
          donorSubmitterId: 'AB2',
          specimenSubmitterId: 'SP1',
          sampleSubmitterId: 'AM1',
          value: 'XYZ',
          originalValue: 'XYZZ',
        },
        message: VALUE_ALREADY_REGISTERED_MSG,
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
        fieldName: SampleRegistrationFieldsEnum.submitter_sample_id,
        index: 0,
        info: {
          conflictingRows: [1],
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP2',
          value: 'AM1',
        },
        type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT,
        message: NEW_SAMPLE_ID_CONFLICT,
      };

      const row1Err = {
        fieldName: SampleRegistrationFieldsEnum.submitter_sample_id,
        index: 1,
        info: {
          conflictingRows: [0],
          donorSubmitterId: 'AB2',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'AM1',
        },
        message: NEW_SAMPLE_ID_CONFLICT,
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
        fieldName: SampleRegistrationFieldsEnum.submitter_specimen_id,
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
        fieldName: SampleRegistrationFieldsEnum.submitter_specimen_id,
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
        fieldName: SampleRegistrationFieldsEnum.specimen_tissue_source,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'XYX',
          conflictingRows: [2],
        },
        message: NEW_SPEC_ATTR_CONFLICT,
        type: DataValidationErrors.NEW_SPECIMEN_ATTR_CONFLICT,
      };

      const row2Err: SubmissionValidationError = {
        fieldName: SampleRegistrationFieldsEnum.specimen_tissue_source,
        index: 2,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM2',
          specimenSubmitterId: 'SP1',
          value: 'XYz',
          conflictingRows: [0],
        },
        message: NEW_SPEC_ATTR_CONFLICT,
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
        fieldName: SampleRegistrationFieldsEnum.sample_type,
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
        fieldName: SampleRegistrationFieldsEnum.sample_type,
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
        fieldName: SampleRegistrationFieldsEnum.gender,
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
        fieldName: SampleRegistrationFieldsEnum.gender,
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
        fieldName: SampleRegistrationFieldsEnum.submitter_sample_id,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'AM1',
          conflictingRows: [2],
        },
        message: NEW_SAMPLE_ID_CONFLICT,
        type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT,
      };

      const row2Err: SubmissionValidationError = {
        fieldName: SampleRegistrationFieldsEnum.submitter_sample_id,
        index: 2,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP2',
          value: 'AM1',
          conflictingRows: [0],
        },
        message: NEW_SAMPLE_ID_CONFLICT,
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
        fieldName: SampleRegistrationFieldsEnum.sample_type,
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
        fieldName: SampleRegistrationFieldsEnum.sample_type,
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
        fieldName: SampleRegistrationFieldsEnum.submitter_sample_id,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'AM1',
          conflictingRows: [1, 2],
        },
        message: NEW_SAMPLE_ID_CONFLICT,
        type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT,
      };
      const row1Err = {
        fieldName: SampleRegistrationFieldsEnum.submitter_sample_id,
        index: 1,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'AM1',
          conflictingRows: [0, 2],
        },
        message: NEW_SAMPLE_ID_CONFLICT,
        type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT,
      };
      const row2Err = {
        fieldName: SampleRegistrationFieldsEnum.submitter_sample_id,
        index: 2,
        info: {
          donorSubmitterId: 'AB1',
          sampleSubmitterId: 'AM1',
          specimenSubmitterId: 'SP1',
          value: 'AM1',
          conflictingRows: [0, 1],
        },
        message: NEW_SAMPLE_ID_CONFLICT,
        type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT,
      };

      chai.expect(result.errors.length).to.eq(3);
      chai.expect(result.errors[0]).to.deep.eq(row0Err);
      chai.expect(result.errors[1]).to.deep.eq(row1Err);
      chai.expect(result.errors[2]).to.deep.eq(row2Err);
    });
  });

  describe('submission-validations: donor & specimen', () => {
    it('should validate donor and specimen ids for specimen submissions', async () => {
      const existingDonorAB2Mock: Donor = stubs.validation.existingDonor04();
      const newDonorAB1Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP1',
          index: 2,
        },
      );
      const newDonorAB2Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB2Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB2',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP2',
          index: 0,
        },
      );
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB2Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB2',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP3',
          index: 1,
        },
      );

      const result = await dv
        .validateSubmissionData(
          { AB2: newDonorAB2Records, AB1: newDonorAB1Records },
          { AB2: existingDonorAB2Mock },
        )
        .catch((err: any) => fail(err));
      const specimenIdErr1: SubmissionValidationError = {
        fieldName: SampleRegistrationFieldsEnum.submitter_specimen_id,
        message: `SP2 has not yet been registered. Please register samples before submitting clinical data for this identifier.`,
        type: DataValidationErrors.ID_NOT_REGISTERED,
        index: 0,
        info: {
          donorSubmitterId: 'AB2',
          value: 'SP2',
        },
      };
      const specimenIdErr2: SubmissionValidationError = {
        fieldName: SampleRegistrationFieldsEnum.submitter_specimen_id,
        message: `SP3 has not yet been registered. Please register samples before submitting clinical data for this identifier.`,
        type: DataValidationErrors.ID_NOT_REGISTERED,
        index: 1,
        info: {
          donorSubmitterId: 'AB2',
          value: 'SP3',
        },
      };
      const donorIdErr: SubmissionValidationError = {
        fieldName: SampleRegistrationFieldsEnum.submitter_donor_id,
        message:
          'AB1 has not yet been registered. Please register samples before submitting clinical data for this identifier.',
        type: DataValidationErrors.ID_NOT_REGISTERED,
        index: 2,
        info: {
          donorSubmitterId: 'AB1',
          value: 'AB1',
        },
      };

      chai.expect(result.specimen.dataErrors.length).to.eq(3);
      chai.expect(result.specimen.dataErrors).to.deep.include(specimenIdErr1);
      chai.expect(result.specimen.dataErrors).to.deep.include(specimenIdErr2);
      chai.expect(result.specimen.dataErrors).to.deep.include(donorIdErr);
    });
    it('should validate time intervals between donor and specimen', async () => {
      const existingDonorAB2Mock: Donor = stubs.validation.existingDonor04();
      const existingDonorAB3Mock: Donor = stubs.validation.existingDonor03();

      const newDonorAB2Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB2Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB2',
          [SampleRegistrationFieldsEnum.program_id]: 'PEME-CA',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP13',
          [SpecimenFieldsEnum.acquisition_interval]: 5020,
          index: 0,
        },
      );
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB2Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB2',
          [SampleRegistrationFieldsEnum.program_id]: 'PEME-CA',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP14',
          [SpecimenFieldsEnum.acquisition_interval]: 9000,
          index: 1,
        },
      );
      const newDonorAB3Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB3Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB3',
          [SampleRegistrationFieldsEnum.program_id]: 'PEME-CA',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP12',
          [SpecimenFieldsEnum.acquisition_interval]: 2000,
          index: 0,
        },
      );
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.DONOR,
        newDonorAB3Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB3',
          [SampleRegistrationFieldsEnum.program_id]: 'PEME-CA',
          [DonorFieldsEnum.vital_status]: 'deceased',
          [DonorFieldsEnum.survival_time]: 522,
          index: 0,
        },
      );
      // AB2 is where only specimen is being uploaded and donor already has clinicalInfo
      // AB3 is when donor and specimen are being updated
      const errors = await dv
        .validateSubmissionData(
          {
            AB2: newDonorAB2Records,
            AB3: newDonorAB3Records,
          },
          { AB2: existingDonorAB2Mock, AB3: existingDonorAB3Mock },
        )
        .catch(err => fail(err));
      const specimenIntervalErr: SubmissionValidationError = {
        fieldName: SpecimenFieldsEnum.acquisition_interval,
        message: 'survival_time cannot be less than Specimen acquisition_interval.',
        type: DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        index: 0,
        info: {
          donorSubmitterId: 'AB2',
          value: 5020,
        },
      };
      const specimenIntervalErr2 = {
        fieldName: SpecimenFieldsEnum.acquisition_interval,
        type: DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        index: 1,
        info: {
          donorSubmitterId: 'AB2',
          value: 9000,
        },
      };
      const specimenIntervalErr3 = {
        fieldName: SpecimenFieldsEnum.acquisition_interval,
        type: DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        index: 0,
        info: {
          donorSubmitterId: 'AB3',
          value: 2000,
        },
      };
      const donorSurvivalTimeErr = {
        fieldName: DonorFieldsEnum.survival_time,
        type: DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        index: 0,
        info: {
          conflictingSpecimenSubmitterIds: ['SP12'],
          donorSubmitterId: 'AB3',
          value: 522,
        },
      };

      chai.expect(errors.specimen.dataErrors.length).to.eq(3);
      chai.expect(errors.specimen.dataErrors[0]).to.deep.include(specimenIntervalErr);
      chai.expect(errors.specimen.dataErrors[1]).to.deep.include(specimenIntervalErr2);
      chai.expect(errors.specimen.dataErrors[2]).to.deep.include(specimenIntervalErr3);
      chai.expect(errors.donor.dataErrors.length).to.eq(1);
      chai.expect(errors.donor.dataErrors[0]).to.deep.include(donorSurvivalTimeErr);
    });
    it('should detect not enough info to validate specimen file', async () => {
      const existingDonorMock: Donor = stubs.validation.existingDonor01();
      const newDonorAB1Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP13',
          [SpecimenFieldsEnum.acquisition_interval]: 200,
          index: 0,
        },
      );
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP14',
          [SpecimenFieldsEnum.acquisition_interval]: 200,
          index: 1,
        },
      );

      const result = await dv
        .validateSubmissionData({ AB1: newDonorAB1Records }, { AB1: existingDonorMock })
        .catch((err: any) => fail(err));

      const specimenIdErr1: SubmissionValidationError = {
        fieldName: SpecimenFieldsEnum.acquisition_interval,
        message: `[acquisition_interval] requires [donor.vital_status], [donor.survival_time] in order to complete validation.  Please upload data for all fields in this clinical data submission.`,
        type: DataValidationErrors.NOT_ENOUGH_INFO_TO_VALIDATE,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          value: 200,
          missingField: [
            ClinicalEntitySchemaNames.DONOR + '.' + DonorFieldsEnum.vital_status,
            ClinicalEntitySchemaNames.DONOR + '.' + DonorFieldsEnum.survival_time,
          ],
        },
      };

      const specimenIdErr2: SubmissionValidationError = {
        fieldName: SpecimenFieldsEnum.acquisition_interval,
        message: `[acquisition_interval] requires [donor.vital_status], [donor.survival_time] in order to complete validation.  Please upload data for all fields in this clinical data submission.`,
        type: DataValidationErrors.NOT_ENOUGH_INFO_TO_VALIDATE,
        index: 1,
        info: {
          donorSubmitterId: 'AB1',
          value: 200,
          missingField: [
            ClinicalEntitySchemaNames.DONOR + '.' + DonorFieldsEnum.vital_status,
            ClinicalEntitySchemaNames.DONOR + '.' + DonorFieldsEnum.survival_time,
          ],
        },
      };
      chai.expect(result.specimen.dataErrors.length).to.eq(2);
      chai.expect(result.specimen.dataErrors).to.deep.include(specimenIdErr1);
      chai.expect(result.specimen.dataErrors).to.deep.include(specimenIdErr2);
    });
  });
  describe('submission-validations: treatment & therapies', () => {
    it('should detect treatment and missing chemotherapy data', async () => {
      const existingDonorMock: Donor = stubs.validation.existingDonor01();
      const newDonorAB1Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.TREATMENT,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'T_02',
          [TreatmentFieldsEnum.treatment_type]: 'Combined chemo+immunotherapy',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ AB1: newDonorAB1Records }, { AB1: existingDonorMock })
        .catch((err: any) => fail(err));

      const treatmentTherapyErr: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.treatment_type,
        message: `MISSING_THERAPY_DATA`,
        type: DataValidationErrors.MISSING_THERAPY_DATA,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          value: 'Combined chemo+immunotherapy',
          therapyType: ClinicalEntitySchemaNames.CHEMOTHERAPY,
        },
      };
      chai.expect(result.treatment.dataErrors.length).to.eq(1);
      chai.expect(result.treatment.dataErrors).to.deep.include(treatmentTherapyErr);
    });
    it('should detect missing or invalid treatment for chemotherapy', async () => {
      const existingDonorMock: Donor = stubs.validation.existingDonor01();
      const newDonorAB1Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.TREATMENT,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'T_02',
          [TreatmentFieldsEnum.treatment_type]: 'Ablation',
          index: 0,
        },
      );
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.CHEMOTHERAPY,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'T_03',
          index: 0,
        },
      );
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.CHEMOTHERAPY,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'T_02',
          index: 1,
        },
      );

      const result = await dv
        .validateSubmissionData({ AB1: newDonorAB1Records }, { AB1: existingDonorMock })
        .catch((err: any) => fail(err));

      const chemoTretmentIdErr: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.submitter_treatment_id,
        message: `TREATMENT_ID_NOT_FOUND`,
        type: DataValidationErrors.TREATMENT_ID_NOT_FOUND,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          value: 'T_03',
        },
      };
      const chemoTretmentInvalidErr: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.submitter_treatment_id,
        message: `INCOMPATIBLE_PARENT_TREATMENT_TYPE`,
        type: DataValidationErrors.INCOMPATIBLE_PARENT_TREATMENT_TYPE,
        index: 1,
        info: {
          donorSubmitterId: 'AB1',
          value: 'T_02',
          treatment_type: 'Ablation',
        },
      };
      chai.expect(result.chemotherapy.dataErrors.length).to.eq(2);
      chai.expect(result.chemotherapy.dataErrors).to.deep.include(chemoTretmentIdErr);
      chai.expect(result.chemotherapy.dataErrors).to.deep.include(chemoTretmentInvalidErr);
    });
  });

  describe('follow up validation', () => {
    it('should detect follow up belongs to other donor', async () => {
      const donorOwnsTheFollowupAlready = stubs.validation.existingDonor05();
      donorDaoFindByFollowUpSubmitterIdAndProgramIdStub.returns(
        Promise.resolve<Donor>(donorOwnsTheFollowupAlready),
      );
      const donorToAddFollowupTo: Donor = stubs.validation.existingDonor01();

      const submissionRecordsMap = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.FOLLOW_UP,
        submissionRecordsMap,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.FOLLOW_UP]]: 'FF123',
          some_field: 'asdasd',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ AB1: submissionRecordsMap }, { AB1: donorToAddFollowupTo })
        .catch((err: any) => fail(err));

      chai.expect(result[ClinicalEntitySchemaNames.FOLLOW_UP].dataErrors.length).to.eq(1);
      const followUpError: SubmissionValidationError = {
        fieldName: FollowupFieldsEnum.submitter_follow_up_id,
        message: `This follow up has already been associated to donor AB2. Please correct your file.`,
        type: DataValidationErrors.FOLLOWUP_BELONGS_TO_OTHER_DONOR,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          value: 'FF123',
          otherDonorSubmitterId: 'AB2',
        },
      };
      chai
        .expect(result[ClinicalEntitySchemaNames.FOLLOW_UP].dataErrors[0])
        .to.deep.eq(followUpError);
    });
  });
});
