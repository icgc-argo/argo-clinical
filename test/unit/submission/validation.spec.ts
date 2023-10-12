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

import chai from 'chai';
import sinon from 'sinon';
import _ from 'lodash';
import { donorDao } from '../../../src/clinical/donor-repo';
import * as dv from '../../../src/submission/validation-clinical/validation';
import {
  SubmissionValidationError,
  DataValidationErrors,
  CreateRegistrationRecord,
  SampleRegistrationFieldsEnum,
} from '../../../src/submission/submission-entities';
import { Donor } from '../../../src/clinical/clinical-entities';
import { stubs } from './stubs';
import { fail } from 'assert';
import {
  ClinicalSubmissionRecordsOperations,
  usingInvalidProgramId,
} from '../../../src/submission/validation-clinical/utils';
import {
  ClinicalEntitySchemaNames,
  SpecimenFieldsEnum,
  DonorFieldsEnum,
  TreatmentFieldsEnum,
  FollowupFieldsEnum,
  ClinicalUniqueIdentifier,
  PrimaryDiagnosisFieldsEnum,
  SurgeryFieldsEnum,
  RadiationFieldsEnum,
} from '../../../src/common-model/entities';
import featureFlags from '../../../src/feature-flags';

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
  fieldName: SampleRegistrationFieldsEnum.specimen_type,
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
  let donorDaoCountByStub: sinon.SinonStub<[any], any>;
  let donorDaoFindBySpecimenSubmitterIdAndProgramIdStub: sinon.SinonStub<[any], any>;
  let donorDaoFindBySampleSubmitterIdAndProgramIdStub: sinon.SinonStub<[any], any>;
  let donorDaoFindByClinicalEntitySubmitterIdAndProgramIdStub: sinon.SinonStub<[any, any], any>;
  let donorDaoFindByPaginatedProgramId: sinon.SinonStub<[any, any], any>;
  let radiationFeatureFlagStub: sinon.SinonStub<any, any>;

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

    donorDaoFindByClinicalEntitySubmitterIdAndProgramIdStub = sinon.stub(
      donorDao,
      'findByClinicalEntitySubmitterIdAndProgramId',
    );

    donorDaoFindByPaginatedProgramId = sinon
      .stub(donorDao, 'findByPaginatedProgramId')
      .resolves({ donors: [], totalDonors: 0 });

    radiationFeatureFlagStub = sinon
      .stub(featureFlags, 'FEATURE_REFERENCE_RADIATION_ENABLED')
      .value(true);

    done();
  });

  afterEach(done => {
    donorDaoCountByStub.restore();
    donorDaoFindBySpecimenSubmitterIdAndProgramIdStub.restore();
    donorDaoFindBySampleSubmitterIdAndProgramIdStub.restore();
    donorDaoFindByClinicalEntitySubmitterIdAndProgramIdStub.restore();
    donorDaoFindByPaginatedProgramId.restore();
    radiationFeatureFlagStub.restore();
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
          [SampleRegistrationFieldsEnum.specimen_type]: 'Normal',
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
            specimenType: 'Normal',
          },
        ],
        {
          SP1: existingDonorMock,
          SP13: existingDonorMock,
          SP14: existingDonorMock,
        },
        {
          AM1: existingDonorMock,
        },
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
            specimenType: 'Normal',
          },
        ],
        {
          SP1: existingDonorMock,
          SP13: existingDonorMock,
          SP14: existingDonorMock,
        },
        {
          AM1: existingDonorMock,
        },
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
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Female',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST1',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
            specimenType: 'Normal2',
          },
        ],
        {
          SP1: existingDonorMock,
          SP13: existingDonorMock,
          SP14: existingDonorMock,
        },
        {
          AM1: existingDonorMock,
        },
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
            specimenType: 'Normal',
          },
        ],
        {
          SP1: existingDonorMock,
          SP13: existingDonorMock,
          SP14: existingDonorMock,
        },
        {
          AM1: existingDonorMock,
        },
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
        specimenType: 'Normal',
      };
      // test call
      const result = await dv.validateRegistrationData(
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Male',
            programId: 'PEM-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZQ',
            sampleType: 'ST11',
            specimenSubmitterId: 'SP1',
            tumourNormalDesignation: 'Normal',
            specimenType: 'Normal2',
          },
          valid2ndRecord,
        ],
        {
          SP1: existingDonorMock,
          SP13: existingDonorMock,
          SP14: existingDonorMock,
        },
        {
          AM1: existingDonorMock,
        },
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
      const existingDonor02 = stubs.validation.existingDonor02();
      // test call
      const result = await dv.validateRegistrationData(
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
            specimenType: 'Normal',
          },
        ],
        {
          SP1: existingDonor02,
        },
        {
          AM1: existingDonor02,
        },
        { AB1: existingDonor02 },
      );

      // assertions
      chai.expect(result.errors.length).to.eq(2);
      chai.expect(result.errors).to.deep.include(specimenBelongsToOtherDonor);
    });

    // see issue https://github.com/icgc-argo/argo-clinical/issues/112
    it('should detect specimen belongs to other donor and specimen type changed', async () => {
      const existingDonor02 = stubs.validation.existingDonor02();

      donorDaoFindBySampleSubmitterIdAndProgramIdStub.returns(
        Promise.resolve(stubs.validation.existingDonor02()),
      );

      donorDaoFindBySpecimenSubmitterIdAndProgramIdStub.returns(
        Promise.resolve<Donor>(stubs.validation.existingDonor02()),
      );

      // test call
      const result = await dv.validateRegistrationData(
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
            specimenType: 'Normal',
          },
        ],
        {
          SP1: existingDonor02,
        },
        {
          AM1: existingDonor02,
        },
        { AB1: existingDonor02 },
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
      const existingDonorMock: Donor = stubs.validation.existingDonor01();

      // test call
      const result = await dv.validateRegistrationData(
        [
          {
            donorSubmitterId: 'AB1',
            gender: 'Female',
            programId: 'PEME-CA',
            sampleSubmitterId: 'AM1',
            specimenTissueSource: 'XYZ',
            sampleType: 'ST1',
            specimenSubmitterId: 'SP2',
            tumourNormalDesignation: 'Normal',
            specimenType: 'Normal',
          },
        ],
        {
          SP1: existingDonorMock,
          SP13: existingDonorMock,
          SP14: existingDonorMock,
        },
        {
          AM1: existingDonorMock,
        },
        { AB1: existingDonorMock },
      );

      // assertions
      chai.expect(result.errors.length).to.eq(1);
      chai.expect(result.errors[0]).to.deep.eq(sampleBelongsToOtherSpecimenAB1);
    });

    it('should detect sample belongs to other specimen, different donor', async () => {
      const existingDonor02 = stubs.validation.existingDonor02();
      donorDaoFindBySpecimenSubmitterIdAndProgramIdStub.returns(
        Promise.resolve<Donor>(stubs.validation.existingDonor02()),
      );
      donorDaoFindBySampleSubmitterIdAndProgramIdStub.returns(
        Promise.resolve<Donor>(stubs.validation.existingDonor02()),
      );
      // test call
      const result = await dv.validateRegistrationData(
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
            specimenType: 'Normal',
          },
        ],
        {
          SP1: existingDonor02,
        },
        {
          AM1: existingDonor02,
        },
        { AB1: existingDonor02 },
      );

      // assertions
      chai.expect(result.errors.length).to.eq(1);
      chai.expect(result.errors).to.deep.include(sampleBelongsToOtherSpecimenAB2);
    });

    // different donor different specimen same sample id
    it('should detect sample id conflict between new registrations', async () => {
      donorDaoCountByStub.returns(Promise.resolve(0));
      // test call
      const result = await dv.validateRegistrationData(
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
          },
        ],
        {},
        {},
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
          },
        ],
        {},
        {},
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
          },
        ],
        {},
        {},
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
          },
        ],
        {},
        {},
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
          },
        ],
        {},
        {},
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
          },
        ],
        {},
        {},
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
          },
        ],
        {},
        {},
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
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
            specimenType: 'Normal',
          },
        ],
        {},
        {},
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
          [SpecimenFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP13',
          [SpecimenFieldsEnum.specimen_acquisition_interval]: 5020,
          index: 0,
        },
      );
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB2Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB2',
          [SampleRegistrationFieldsEnum.program_id]: 'PEME-CA',
          [SpecimenFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP14',
          [SpecimenFieldsEnum.specimen_acquisition_interval]: 9000,
          index: 1,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        newDonorAB2Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'AB2',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'PEME-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          [PrimaryDiagnosisFieldsEnum.age_at_diagnosis]: 33,
          index: 0,
        },
      );

      const newDonorAB3Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB3Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB3',
          [SampleRegistrationFieldsEnum.program_id]: 'PEME-CA',
          [SpecimenFieldsEnum.submitter_primary_diagnosis_id]: 'PP-3',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP12',
          [SpecimenFieldsEnum.specimen_acquisition_interval]: 2000,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        newDonorAB3Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'AB3',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'PEME-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-3',
          [PrimaryDiagnosisFieldsEnum.age_at_diagnosis]: 30,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.DONOR,
        newDonorAB3Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB3',
          [SampleRegistrationFieldsEnum.program_id]: 'PEME-CA',
          [DonorFieldsEnum.vital_status]: 'Deceased',
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
        fieldName: SpecimenFieldsEnum.specimen_acquisition_interval,
        message: 'survival_time cannot be less than Specimen specimen_acquisition_interval.',
        type: DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        index: 0,
        info: {
          donorSubmitterId: 'AB2',
          value: 5020,
        },
      };
      const specimenIntervalErr2 = {
        fieldName: SpecimenFieldsEnum.specimen_acquisition_interval,
        type: DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        index: 1,
        info: {
          donorSubmitterId: 'AB2',
          value: 9000,
        },
      };
      const specimenIntervalErr3 = {
        fieldName: SpecimenFieldsEnum.specimen_acquisition_interval,
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
    it('should validate time intervals between alive donor and specimen', async () => {
      const existingDonorAB1Mock: Donor = stubs.validation.existingDonor01();
      const submittedAB1Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.DONOR,
        submittedAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB2',
          [SampleRegistrationFieldsEnum.program_id]: 'PEME-CA',
          [DonorFieldsEnum.vital_status]: 'alive',
          index: 0,
        },
      );
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        submittedAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB2',
          [SampleRegistrationFieldsEnum.program_id]: 'PEME-CA',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP1',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          [SpecimenFieldsEnum.specimen_acquisition_interval]: 5020,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        submittedAB1Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'AB2',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'PEME-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ AB1: submittedAB1Records }, { AB1: existingDonorAB1Mock })
        .catch(err => fail(err));

      // donor is alive so should have no time interval validation errors
      chai.expect(result[ClinicalEntitySchemaNames.DONOR].dataErrors.length).to.eq(0);
      chai.expect(result[ClinicalEntitySchemaNames.SPECIMEN].dataErrors.length).to.eq(0);
    });

    it('should detect submitted Lost to Follow Up After Clinical Event ID exists', async () => {
      const existingDonorAB1Mock: Donor = stubs.validation.existingDonor01();
      const submittedAB1Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.DONOR,
        submittedAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'DN190',
          [SampleRegistrationFieldsEnum.program_id]: 'TEST-CA',
          [DonorFieldsEnum.vital_status]: 'alive',
          lost_to_followup_after_clinical_event_id: 'FL-23',
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.FOLLOW_UP,
        submittedAB1Records,
        {
          [FollowupFieldsEnum.submitter_donor_id]: 'DN190',
          [FollowupFieldsEnum.program_id]: 'TEST-CA',
          [FollowupFieldsEnum.submitter_follow_up_id]: 'FL-21',
          [FollowupFieldsEnum.interval_of_followup]: 230,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.TREATMENT,
        submittedAB1Records,
        {
          [FollowupFieldsEnum.submitter_donor_id]: 'DN190',
          [FollowupFieldsEnum.program_id]: 'TEST-CA',
          [FollowupFieldsEnum.submitter_follow_up_id]: 'FL-33',
          [FollowupFieldsEnum.interval_of_followup]: 300,
          index: 0,
        },
      );

      const donorIdConflictErr: SubmissionValidationError = {
        type: DataValidationErrors['INVALID_LOST_TO_FOLLOW_UP_ID'],
        fieldName: DonorFieldsEnum.lost_to_followup_after_clinical_event_id,
        index: 0,
        info: {
          lost_to_followup_after_clinical_event_id: 'FL-23',
          donorSubmitterId: 'DN190',
          value: 'FL-23',
        },
        message: `The identifier 'FL-23' submitted in the 'lost_to_followup_after_clinical_event_id' field does not exist in your clinical submission.`,
      };

      const result = await dv
        .validateSubmissionData({ AB1: submittedAB1Records }, { AB1: existingDonorAB1Mock })
        .catch(err => fail(err));

      chai.expect(result[ClinicalEntitySchemaNames.DONOR].dataErrors.length).to.eq(1);
      chai
        .expect(result[ClinicalEntitySchemaNames.DONOR].dataErrors)
        .to.deep.include(donorIdConflictErr);
    });

    it('should detect there are no further clinical events submitted after a Lost to Follow Up clinical event', async () => {
      const existingDonorAB1Mock: Donor = stubs.validation.existingDonor01();
      const submittedAB1Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.DONOR,
        submittedAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'DN190',
          [SampleRegistrationFieldsEnum.program_id]: 'TEST-CA',
          [DonorFieldsEnum.vital_status]: 'alive',
          lost_to_followup_after_clinical_event_id: 'FL-23',
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        submittedAB1Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'DN190',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'TEST-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          [PrimaryDiagnosisFieldsEnum.age_at_diagnosis]: 30,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        submittedAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'DN190',
          [SampleRegistrationFieldsEnum.program_id]: 'TEST-CA',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP1',
          [SpecimenFieldsEnum.specimen_acquisition_interval]: 5020,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.FOLLOW_UP,
        submittedAB1Records,
        {
          [FollowupFieldsEnum.submitter_donor_id]: 'DN190',
          [FollowupFieldsEnum.program_id]: 'TEST-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          [FollowupFieldsEnum.submitter_follow_up_id]: 'FL-23',
          [FollowupFieldsEnum.interval_of_followup]: 230,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.TREATMENT,
        submittedAB1Records,
        {
          [TreatmentFieldsEnum.submitter_donor_id]: 'DN190',
          [TreatmentFieldsEnum.program_id]: 'TEST-CA',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'TR-33',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          [TreatmentFieldsEnum.treatment_start_interval]: 250,
          [TreatmentFieldsEnum.treatment_duration]: 50,
          index: 0,
        },
      );

      const submissionConflictErr: SubmissionValidationError = {
        type: DataValidationErrors['INVALID_SUBMISSION_AFTER_LOST_TO_FOLLOW_UP'],
        fieldName: DonorFieldsEnum.lost_to_followup_after_clinical_event_id,
        index: 0,
        info: {
          lost_to_followup_after_clinical_event_id: 'FL-23',
          lost_to_followup_interval: 230,
          donorSubmitterId: 'DN190',
          submission_type: 'treatment',
          treatment_id: 'TR-33',
          value: 'FL-23',
        },
        message:
          'A clinical event that occurs after the donor was lost to follow up cannot be submitted. The donor was indicated to be lost to follow up 230 days after their primary diagnosis ("lost_to_followup_after_clinical_event_id" = "FL-23"), but a new treatment ("TR-33") that started after the donor was lost to follow up has been submitted. If the donor was found later on, then update the "lost_to_followup_after_clinical_event_id" field to be empty.',
      };

      const result = await dv
        .validateSubmissionData({ AB1: submittedAB1Records }, { AB1: existingDonorAB1Mock })
        .catch(err => fail(err));

      chai.expect(result[ClinicalEntitySchemaNames.DONOR].dataErrors.length).to.eq(1);
      chai
        .expect(result[ClinicalEntitySchemaNames.DONOR].dataErrors)
        .to.deep.include(submissionConflictErr);
    });

    it('should not allow submission of a new Primary Diagnosis after a Lost to Follow Up After clinical event', async () => {
      const existingDonorAB1Mock: Donor = stubs.validation.existingDonor01();
      const submittedAB1Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.DONOR,
        submittedAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'DN190',
          [SampleRegistrationFieldsEnum.program_id]: 'TEST-CA',
          [DonorFieldsEnum.vital_status]: 'alive',
          lost_to_followup_after_clinical_event_id: 'FL-23',
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        submittedAB1Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'DN190',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'TEST-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          [PrimaryDiagnosisFieldsEnum.age_at_diagnosis]: 30,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.FOLLOW_UP,
        submittedAB1Records,
        {
          [FollowupFieldsEnum.submitter_donor_id]: 'DN190',
          [FollowupFieldsEnum.program_id]: 'TEST-CA',
          [FollowupFieldsEnum.submitter_follow_up_id]: 'FL-23',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          [FollowupFieldsEnum.interval_of_followup]: 230,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        submittedAB1Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'DN190',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'TEST-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          [PrimaryDiagnosisFieldsEnum.age_at_diagnosis]: 50,
          index: 0,
        },
      );

      const diagnosisConflictErr: SubmissionValidationError = {
        type: DataValidationErrors['INVALID_DIAGNOSIS_AFTER_LOST_TO_FOLLOW_UP'],
        fieldName: DonorFieldsEnum.lost_to_followup_after_clinical_event_id,
        index: 0,
        info: {
          lost_to_follow_up_diagnosis_id: 'PP-1',
          lost_to_follow_up_age: 30,
          submitter_primary_diagnosis_id: 'PP-2',
          donorSubmitterId: 'DN190',
          value: 'FL-23',
        },
        message:
          'A clinical event that occurs after the donor was lost to follow up cannot be submitted. The donor was indicated to be lost to follow up at age PP-1 after their primary diagnosis ("submitter_primary_diagnosis_id" = "30"), but a new primary diagnosis ("PP-2") that started after the donor was lost to follow up has been submitted. If the donor was found later on, then update the "lost_to_followup_after_clinical_event_id" field to be empty.',
      };

      const result = await dv
        .validateSubmissionData({ AB1: submittedAB1Records }, { AB1: existingDonorAB1Mock })
        .catch(err => fail(err));

      chai.expect(result[ClinicalEntitySchemaNames.DONOR].dataErrors.length).to.eq(1);

      chai
        .expect(result[ClinicalEntitySchemaNames.DONOR].dataErrors)
        .to.deep.include(diagnosisConflictErr);
    });

    it('should accurately validate records across multiple Primary Diagnoses when a Lost to Follow Up clinical event is submitted', async () => {
      const existingDonorAB1Mock: Donor = stubs.validation.existingDonor01();
      const submittedAB1Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.DONOR,
        submittedAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'DN190',
          [SampleRegistrationFieldsEnum.program_id]: 'TEST-CA',
          [DonorFieldsEnum.vital_status]: 'alive',
          lost_to_followup_after_clinical_event_id: 'FL-23',
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        submittedAB1Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'DN190',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'TEST-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          [PrimaryDiagnosisFieldsEnum.age_at_diagnosis]: 30,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.FOLLOW_UP,
        submittedAB1Records,
        {
          [FollowupFieldsEnum.submitter_donor_id]: 'DN190',
          [FollowupFieldsEnum.program_id]: 'TEST-CA',
          [FollowupFieldsEnum.submitter_follow_up_id]: 'FL-23',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          [FollowupFieldsEnum.interval_of_followup]: 350,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.TREATMENT,
        submittedAB1Records,
        {
          [TreatmentFieldsEnum.submitter_donor_id]: 'DN190',
          [TreatmentFieldsEnum.program_id]: 'TEST-CA',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'TR-33',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          [TreatmentFieldsEnum.treatment_start_interval]: 250,
          [TreatmentFieldsEnum.treatment_duration]: 50,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        submittedAB1Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'DN190',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'TEST-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          [PrimaryDiagnosisFieldsEnum.age_at_diagnosis]: 50,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.FOLLOW_UP,
        submittedAB1Records,
        {
          [FollowupFieldsEnum.submitter_donor_id]: 'DN190',
          [FollowupFieldsEnum.program_id]: 'TEST-CA',
          [FollowupFieldsEnum.submitter_follow_up_id]: 'FL-24',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          [FollowupFieldsEnum.interval_of_followup]: 230,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.TREATMENT,
        submittedAB1Records,
        {
          [TreatmentFieldsEnum.submitter_donor_id]: 'DN190',
          [TreatmentFieldsEnum.program_id]: 'TEST-CA',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'TR-34',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          [TreatmentFieldsEnum.treatment_start_interval]: 250,
          [TreatmentFieldsEnum.treatment_duration]: 50,
          index: 0,
        },
      );

      const invalidFollowUpErr: SubmissionValidationError = {
        type: DataValidationErrors['INVALID_SUBMISSION_AFTER_LOST_TO_FOLLOW_UP'],
        fieldName: DonorFieldsEnum.lost_to_followup_after_clinical_event_id,
        index: 0,
        info: {
          lost_to_followup_after_clinical_event_id: 'FL-23',
          lost_to_followup_interval: 350,
          treatment_id: 'FL-24',
          submission_type: 'follow up',
          donorSubmitterId: 'DN190',
          value: 'FL-23',
        },
        message:
          'A clinical event that occurs after the donor was lost to follow up cannot be submitted. The donor was indicated to be lost to follow up 350 days after their primary diagnosis ("lost_to_followup_after_clinical_event_id" = "FL-23"), but a new follow up ("FL-24") that started after the donor was lost to follow up has been submitted. If the donor was found later on, then update the "lost_to_followup_after_clinical_event_id" field to be empty.',
      };

      const invalidTreatmenErr: SubmissionValidationError = {
        type: DataValidationErrors['INVALID_SUBMISSION_AFTER_LOST_TO_FOLLOW_UP'],
        fieldName: DonorFieldsEnum.lost_to_followup_after_clinical_event_id,
        index: 0,
        info: {
          lost_to_followup_after_clinical_event_id: 'FL-23',
          lost_to_followup_interval: 350,
          treatment_id: 'TR-34',
          submission_type: 'treatment',
          donorSubmitterId: 'DN190',
          value: 'FL-23',
        },
        message:
          'A clinical event that occurs after the donor was lost to follow up cannot be submitted. The donor was indicated to be lost to follow up 350 days after their primary diagnosis ("lost_to_followup_after_clinical_event_id" = "FL-23"), but a new treatment ("TR-34") that started after the donor was lost to follow up has been submitted. If the donor was found later on, then update the "lost_to_followup_after_clinical_event_id" field to be empty.',
      };

      const invalidDiagnosisErr: SubmissionValidationError = {
        type: DataValidationErrors['INVALID_DIAGNOSIS_AFTER_LOST_TO_FOLLOW_UP'],
        fieldName: DonorFieldsEnum.lost_to_followup_after_clinical_event_id,
        index: 0,
        info: {
          lost_to_follow_up_diagnosis_id: 'PP-1',
          lost_to_follow_up_age: 30,
          submitter_primary_diagnosis_id: 'PP-2',
          donorSubmitterId: 'DN190',
          value: 'FL-23',
        },
        message:
          'A clinical event that occurs after the donor was lost to follow up cannot be submitted. The donor was indicated to be lost to follow up at age PP-1 after their primary diagnosis ("submitter_primary_diagnosis_id" = "30"), but a new primary diagnosis ("PP-2") that started after the donor was lost to follow up has been submitted. If the donor was found later on, then update the "lost_to_followup_after_clinical_event_id" field to be empty.',
      };

      const result = await dv
        .validateSubmissionData({ AB1: submittedAB1Records }, { AB1: existingDonorAB1Mock })
        .catch(err => fail(err));

      console.log('\nresult', result[ClinicalEntitySchemaNames.DONOR].dataErrors);

      chai.expect(result[ClinicalEntitySchemaNames.DONOR].dataErrors.length).to.eq(3);

      chai
        .expect(result[ClinicalEntitySchemaNames.DONOR].dataErrors)
        .to.deep.include(invalidFollowUpErr);

      chai
        .expect(result[ClinicalEntitySchemaNames.DONOR].dataErrors)
        .to.deep.include(invalidTreatmenErr);

      chai
        .expect(result[ClinicalEntitySchemaNames.DONOR].dataErrors)
        .to.deep.include(invalidDiagnosisErr);
    });

    it('should display correct errors for invalid Follow Up and Specimen submitted after a Lost to Follow Up clinical event', async () => {
      const existingDonorAB1Mock: Donor = stubs.validation.existingDonor01();
      const submittedAB1Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.DONOR,
        submittedAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'DN190',
          [SampleRegistrationFieldsEnum.program_id]: 'TEST-CA',
          [DonorFieldsEnum.vital_status]: 'alive',
          lost_to_followup_after_clinical_event_id: 'FL-23',
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        submittedAB1Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'DN190',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'TEST-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          [PrimaryDiagnosisFieldsEnum.age_at_diagnosis]: 30,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.FOLLOW_UP,
        submittedAB1Records,
        {
          [FollowupFieldsEnum.submitter_donor_id]: 'DN190',
          [FollowupFieldsEnum.program_id]: 'TEST-CA',
          [FollowupFieldsEnum.submitter_follow_up_id]: 'FL-23',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          [FollowupFieldsEnum.interval_of_followup]: 30,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.FOLLOW_UP,
        submittedAB1Records,
        {
          [FollowupFieldsEnum.submitter_donor_id]: 'DN190',
          [FollowupFieldsEnum.program_id]: 'TEST-CA',
          [FollowupFieldsEnum.submitter_follow_up_id]: 'FL-24',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          [FollowupFieldsEnum.interval_of_followup]: 80,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        submittedAB1Records,
        {
          [SpecimenFieldsEnum.submitter_donor_id]: 'DN190',
          [SpecimenFieldsEnum.program_id]: 'TEST-CA',
          [SpecimenFieldsEnum.submitter_specimen_id]: 'SP1',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          [SpecimenFieldsEnum.specimen_acquisition_interval]: 100,
          [SpecimenFieldsEnum.tumour_grading_system]: 'Gleason grade group system',
          [SpecimenFieldsEnum.tumour_grade]: 'Low grade',
          index: 0,
        },
      );

      const invalidFollowUpErr: SubmissionValidationError = {
        type: DataValidationErrors['INVALID_SUBMISSION_AFTER_LOST_TO_FOLLOW_UP'],
        fieldName: DonorFieldsEnum.lost_to_followup_after_clinical_event_id,
        index: 0,
        info: {
          lost_to_followup_after_clinical_event_id: 'FL-23',
          lost_to_followup_interval: 30,
          treatment_id: 'FL-24',
          submission_type: 'follow up',
          donorSubmitterId: 'DN190',
          value: 'FL-23',
        },
        message:
          'A clinical event that occurs after the donor was lost to follow up cannot be submitted. The donor was indicated to be lost to follow up 30 days after their primary diagnosis ("lost_to_followup_after_clinical_event_id" = "FL-23"), but a new follow up ("FL-24") that started after the donor was lost to follow up has been submitted. If the donor was found later on, then update the "lost_to_followup_after_clinical_event_id" field to be empty.',
      };

      const invalidSpecimenErr: SubmissionValidationError = {
        type: DataValidationErrors['INVALID_SUBMISSION_AFTER_LOST_TO_FOLLOW_UP'],
        fieldName: DonorFieldsEnum.lost_to_followup_after_clinical_event_id,
        index: 0,
        info: {
          lost_to_followup_after_clinical_event_id: 'FL-23',
          lost_to_followup_interval: 30,
          treatment_id: 'SP1',
          submission_type: 'specimen',
          donorSubmitterId: 'DN190',
          value: 'FL-23',
        },
        message:
          'A clinical event that occurs after the donor was lost to follow up cannot be submitted. The donor was indicated to be lost to follow up 30 days after their primary diagnosis ("lost_to_followup_after_clinical_event_id" = "FL-23"), but a new specimen ("SP1") that started after the donor was lost to follow up has been submitted. If the donor was found later on, then update the "lost_to_followup_after_clinical_event_id" field to be empty.',
      };

      const result = await dv
        .validateSubmissionData({ AB1: submittedAB1Records }, { AB1: existingDonorAB1Mock })
        .catch(err => fail(err));

      chai.expect(result[ClinicalEntitySchemaNames.DONOR].dataErrors.length).to.eq(2);

      chai
        .expect(result[ClinicalEntitySchemaNames.DONOR].dataErrors)
        .to.deep.include(invalidFollowUpErr);

      chai
        .expect(result[ClinicalEntitySchemaNames.DONOR].dataErrors)
        .to.deep.include(invalidSpecimenErr);
    });

    it('should detect not enough info to validate specimen file', async () => {
      const existingDonorAB1Mock: Donor = stubs.validation.existingDonor01();
      const existingDonorAB2Mock: Donor = stubs.validation.existingDonor06();
      // Donor AB1 has no clinical info
      const newDonorAB1Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP13',
          [SpecimenFieldsEnum.specimen_acquisition_interval]: 200,
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP14',
          [SpecimenFieldsEnum.specimen_acquisition_interval]: 200,
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          index: 1,
        },
      );

      // Donor AB2 here has clinicalInfo where vital_status===deceased but no survival_time is given
      const newDonorAB2Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB2Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB2',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP1',
          [SpecimenFieldsEnum.specimen_acquisition_interval]: 200,
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          index: 2,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        newDonorAB2Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'AB2',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'PEME-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData(
          { AB1: newDonorAB1Records, AB2: newDonorAB2Records },
          { AB1: existingDonorAB1Mock, AB2: existingDonorAB2Mock },
        )
        .catch((err: any) => fail(err));

      const specimenMisisngDonorAB1FieldsErr: SubmissionValidationError = {
        fieldName: SpecimenFieldsEnum.specimen_acquisition_interval,
        message: `[specimen_acquisition_interval] requires [donor.vital_status], [donor.survival_time] in order to complete validation. Please upload data for all fields in this clinical data submission.`,
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

      const specimenMissingDonorAB2FieldErr: SubmissionValidationError = {
        fieldName: SpecimenFieldsEnum.specimen_acquisition_interval,
        message: `[specimen_acquisition_interval] requires [donor.survival_time] in order to complete validation. Please upload data for all fields in this clinical data submission.`,
        type: DataValidationErrors.NOT_ENOUGH_INFO_TO_VALIDATE,
        index: 2,
        info: {
          donorSubmitterId: 'AB2',
          value: 200,
          missingField: [ClinicalEntitySchemaNames.DONOR + '.' + DonorFieldsEnum.survival_time],
        },
      };

      const primaryDiagnosisMissingError = {
        fieldName: 'submitter_primary_diagnosis_id',
        info: {
          childEntity: 'specimen',
          donorSubmitterId: 'AB1',
          fieldName: 'submitter_primary_diagnosis_id',
          parentEntity: 'primary_diagnosis',
          value: 'PP-1',
        },
        message:
          "[submitter_primary_diagnosis_id] value in [specimen] file requires a matching [submitter_primary_diagnosis_id] in [primary_diagnosis] data. Check that it belongs to the same [submitter_donor_id] = AB1. It could have been previously submitted for a different donor, or if it's new in this submission, it's either missing in [primary_diagnosis] file or this [submitter_primary_diagnosis_id] is associated with different [submitter_donor_id] in the [primary_diagnosis] file.",
        type: 'RELATED_ENTITY_MISSING_OR_CONFLICTING',
      };

      chai.expect(result.specimen.dataErrors.length).to.eq(5);

      chai
        .expect(result.specimen.dataErrors)
        .to.deep.include({ ...primaryDiagnosisMissingError, index: 0 });
      chai
        .expect(result.specimen.dataErrors)
        .to.deep.include({ ...primaryDiagnosisMissingError, index: 1 });
      chai
        .expect(result.specimen.dataErrors)
        .to.deep.include({ ...specimenMisisngDonorAB1FieldsErr, index: 0 });
      chai
        .expect(result.specimen.dataErrors)
        .to.deep.include({ ...specimenMisisngDonorAB1FieldsErr, index: 1 });

      chai.expect(result.specimen.dataErrors).to.deep.include(specimenMissingDonorAB2FieldErr);
    });

    it("should detect forbidden fields in submission record for donor's registered normal specimen", async () => {
      const existingDonorAB1Mock: Donor = stubs.validation.existingDonor04();

      const forbiddenFields = [
        SpecimenFieldsEnum.tumour_grading_system,
        SpecimenFieldsEnum.tumour_grade,
        SpecimenFieldsEnum.pathological_tumour_staging_system,
        SpecimenFieldsEnum.pathological_stage_group,
        SpecimenFieldsEnum.percent_stromal_cells,
        SpecimenFieldsEnum.percent_tumour_cells,
        SpecimenFieldsEnum.percent_proliferating_cells,
        SpecimenFieldsEnum.percent_inflammatory_tissue,
        SpecimenFieldsEnum.percent_necrosis,
        SpecimenFieldsEnum.pathological_m_category,
        SpecimenFieldsEnum.pathological_t_category,
        SpecimenFieldsEnum.pathological_n_category,
        SpecimenFieldsEnum.tumour_histological_type,
        SpecimenFieldsEnum.reference_pathology_confirmed,
      ];

      const newDonorAB1Records = {};
      const specimenFields = _.fromPairs(
        forbiddenFields.map(field => [field, 'a forbidden provided value']),
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB2',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP13',
          [SpecimenFieldsEnum.specimen_acquisition_interval]: 400,
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          index: 0,
          ...specimenFields,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        newDonorAB1Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'AB2',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'PEME-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ AB1: newDonorAB1Records }, { AB1: existingDonorAB1Mock })
        .catch((err: any) => fail(err));

      chai.expect(result.specimen.dataErrors.length).to.eq(forbiddenFields.length);
      result.specimen.dataErrors.forEach(dataError => {
        chai.expect(forbiddenFields).includes(dataError.fieldName);
        chai
          .expect(dataError.type)
          .to.equal(DataValidationErrors.FORBIDDEN_PROVIDED_VARIABLE_REQUIREMENT);
      });
    });

    it("should detect missing required fields in submitted record for donor's registered tumour specimen", async () => {
      const existingDonorAB1Mock: Donor = stubs.validation.existingDonor04();

      const requiredFields = [
        SpecimenFieldsEnum.tumour_grading_system,
        SpecimenFieldsEnum.tumour_grade,
        SpecimenFieldsEnum.percent_tumour_cells,
        SpecimenFieldsEnum.percent_tumour_cells_measurement_method,
        SpecimenFieldsEnum.tumour_histological_type,
        SpecimenFieldsEnum.reference_pathology_confirmed,
      ];

      const newDonorAB1Records = {};
      const specimenFields = _.fromPairs(requiredFields.map(field => [field, undefined]));

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB2',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP15',
          [SpecimenFieldsEnum.specimen_acquisition_interval]: 400,
          index: 0,
          ...specimenFields,
          [SpecimenFieldsEnum.pathological_tumour_staging_system]: 'Ann Arbor staging system',
          [SpecimenFieldsEnum.pathological_stage_group]: 'Stage I',
          [SpecimenFieldsEnum.pathological_m_category]: 'EM',
          [SpecimenFieldsEnum.pathological_n_category]: 'EN',
          [SpecimenFieldsEnum.pathological_t_category]: 'TEE',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        newDonorAB1Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'AB2',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'PEME-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ AB1: newDonorAB1Records }, { AB1: existingDonorAB1Mock })
        .catch((err: any) => fail(err));

      chai.expect(result.specimen.dataErrors.length).to.eq(requiredFields.length);
      result.specimen.dataErrors.forEach(dataError => {
        chai.expect(requiredFields).includes(dataError.fieldName);
        chai.expect(dataError.type).to.equal(DataValidationErrors.MISSING_VARIABLE_REQUIREMENT);
      });
    });

    it('should error when pathological_tumour_staging_system is missing in specimen, and clinical_tumour_staging_system is missing in primary diagnosis', async () => {
      const existingDonorAB1Mock: Donor = stubs.validation.existingDonor04();
      const newDonorAB1Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB2',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP15',
          [SpecimenFieldsEnum.specimen_acquisition_interval]: 400,
          index: 0,
          [SpecimenFieldsEnum.tumour_grading_system]: 'WHO grading system for CNS tumours',
          [SpecimenFieldsEnum.tumour_grade]: 'Grade III',
          [SpecimenFieldsEnum.percent_tumour_cells]: 0.2,
          [SpecimenFieldsEnum.percent_tumour_cells_measurement_method]: 'Genomics',
          [SpecimenFieldsEnum.tumour_histological_type]: '9691/36',
          [SpecimenFieldsEnum.reference_pathology_confirmed]: 'Yes',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
        },
      );

      // should not validate primary diagnosis against a normal specimen:
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SPECIMEN,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB2',
          [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'SP15.1',
          [SpecimenFieldsEnum.specimen_acquisition_interval]: 400,
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          index: 1,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        newDonorAB1Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'AB2',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'PEME-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ AB1: newDonorAB1Records }, { AB1: existingDonorAB1Mock })
        .catch((err: any) => fail(err));

      chai.expect(result.specimen.dataErrors.length).to.eq(1);
      chai.expect(result.primary_diagnosis.dataErrors.length).to.eq(1);
      result.specimen.dataErrors.forEach(dataError => {
        chai.expect(dataError.type).to.equal(DataValidationErrors.TNM_STAGING_FIELDS_MISSING);
      });
    });
  });

  describe('submission-validations: treatment & therapies', () => {
    it('should detect mutating existing treatment', async () => {
      const donorAB2WithExsistingTreatment = stubs.validation.existingDonor06();
      donorDaoFindByClinicalEntitySubmitterIdAndProgramIdStub.returns(
        Promise.resolve<Donor>(donorAB2WithExsistingTreatment),
      );
      const donorAB1WithNoTreatments: Donor = stubs.validation.existingDonor01();
      const submissionRecordsMap = {};

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        submissionRecordsMap,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'AB2',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'PEME-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.TREATMENT,
        submissionRecordsMap,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          [ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.TREATMENT]]: 'T_03',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ AB1: submissionRecordsMap }, { AB1: donorAB1WithNoTreatments })
        .catch((err: any) => fail(err));

      chai.expect(result[ClinicalEntitySchemaNames.TREATMENT].dataErrors.length).to.eq(1);
      const treatmentError: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.submitter_treatment_id,
        message: `This treatment has already been associated to donor AB2. Please correct your file.`,
        type: DataValidationErrors.CLINICAL_ENTITY_BELONGS_TO_OTHER_DONOR,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          value: 'T_03',
          otherDonorSubmitterId: 'AB2',
          clinicalType: ClinicalEntitySchemaNames.TREATMENT,
        },
      };
      chai
        .expect(result[ClinicalEntitySchemaNames.TREATMENT].dataErrors[0])
        .to.deep.eq(treatmentError);
    });

    it('should detect treatment and missing therapy data', async () => {
      const existingDonorMock: Donor = stubs.validation.existingDonor01();
      const newDonorAB1Records = {};

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        newDonorAB1Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'AB2',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'PEME-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.TREATMENT,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'T_02',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-2',
          [TreatmentFieldsEnum.treatment_type]: [
            'Chemotherapy',
            'Radiation therapy',
            'Immunotherapy',
          ],
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ AB1: newDonorAB1Records }, { AB1: existingDonorMock })
        .catch((err: any) => fail(err));

      const treatmentTherapyErr: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.treatment_type,
        message: `Treatments of type [Chemotherapy,Radiation therapy,Immunotherapy] need a corresponding [chemotherapy] record.`,
        type: DataValidationErrors.MISSING_THERAPY_DATA,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          value: ['Chemotherapy', 'Radiation therapy', 'Immunotherapy'],
          therapyType: ClinicalEntitySchemaNames.CHEMOTHERAPY,
        },
      };
      const treatmentTherapyErr2: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.treatment_type,
        message: `Treatments of type [Chemotherapy,Radiation therapy,Immunotherapy] need a corresponding [radiation] record.`,
        type: DataValidationErrors.MISSING_THERAPY_DATA,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          value: ['Chemotherapy', 'Radiation therapy', 'Immunotherapy'],
          therapyType: ClinicalEntitySchemaNames.RADIATION,
        },
      };
      const treatmentTherapyErr3: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.treatment_type,
        message: `Treatments of type [Chemotherapy,Radiation therapy,Immunotherapy] need a corresponding [immunotherapy] record.`,
        type: DataValidationErrors.MISSING_THERAPY_DATA,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          value: ['Chemotherapy', 'Radiation therapy', 'Immunotherapy'],
          therapyType: ClinicalEntitySchemaNames.IMMUNOTHERAPY,
        },
      };
      chai.expect(result.treatment.dataErrors.length).to.eq(3);
      chai.expect(result.treatment.dataErrors).to.deep.include(treatmentTherapyErr);
      chai.expect(result.treatment.dataErrors).to.deep.include(treatmentTherapyErr2);
      chai.expect(result.treatment.dataErrors).to.deep.include(treatmentTherapyErr3);
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
          [TreatmentFieldsEnum.treatment_type]: ['Ablation'],
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

      const chemoTreatmentIdErr: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.submitter_treatment_id,
        message: `Treatment and treatment_type files are required to be initialized together. Please upload a corresponding treatment file in this submission.`,
        type: DataValidationErrors.TREATMENT_ID_NOT_FOUND,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          value: 'T_03',
        },
      };
      const chemoTreatmentInvalidErr: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.submitter_treatment_id,
        message: `[Chemotherapy] records can not be submitted for treatment types of [Ablation].`,
        type: DataValidationErrors.INCOMPATIBLE_PARENT_TREATMENT_TYPE,
        index: 1,
        info: {
          donorSubmitterId: 'AB1',
          value: 'T_02',
          treatment_type: ['Ablation'],
          therapyType: ClinicalEntitySchemaNames.CHEMOTHERAPY,
        },
      };
      chai.expect(result.chemotherapy.dataErrors.length).to.eq(2);
      chai.expect(result.chemotherapy.dataErrors).to.deep.include(chemoTreatmentIdErr);
      chai.expect(result.chemotherapy.dataErrors).to.deep.include(chemoTreatmentInvalidErr);
    });

    it('should detect missing or invalid treatment for immunotheraoy', async () => {
      const existingDonorMock: Donor = stubs.validation.existingDonor01();
      const newDonorAB1Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.TREATMENT,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'T_02',
          [TreatmentFieldsEnum.treatment_type]: ['Ablation'],
          index: 0,
        },
      );
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.IMMUNOTHERAPY,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'T_03',
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.IMMUNOTHERAPY,
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

      const immunotherapyTreatmentIdErr: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.submitter_treatment_id,
        message: `Treatment and treatment_type files are required to be initialized together. Please upload a corresponding treatment file in this submission.`,
        type: DataValidationErrors.TREATMENT_ID_NOT_FOUND,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          value: 'T_03',
        },
      };

      const immunotherapyTreatmentInvalidErr: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.submitter_treatment_id,
        message: `[Immunotherapy] records can not be submitted for treatment types of [Ablation].`,
        type: DataValidationErrors.INCOMPATIBLE_PARENT_TREATMENT_TYPE,
        index: 1,
        info: {
          donorSubmitterId: 'AB1',
          value: 'T_02',
          treatment_type: ['Ablation'],
          therapyType: ClinicalEntitySchemaNames.IMMUNOTHERAPY,
        },
      };

      chai.expect(result.immunotherapy.dataErrors.length).to.eq(2);
      chai.expect(result.immunotherapy.dataErrors).to.deep.include(immunotherapyTreatmentIdErr);
      chai
        .expect(result.immunotherapy.dataErrors)
        .to.deep.include(immunotherapyTreatmentInvalidErr);
    });

    it('should detect deleted therapies from treatment', async () => {
      // a donor with Chemo, Radiation therapies in treatement T_03
      const existingDonorMock: Donor = stubs.validation.existingDonor10();
      const newDonorRecords = {};
      const DonorSubmitterId = 'AB10';
      // delete Radiation therapy and add Ablation therapy
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.TREATMENT,
        newDonorRecords,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB10',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'T_03',
          [TreatmentFieldsEnum.submitter_primary_diagnosis_id]: 'PP1',
          [TreatmentFieldsEnum.treatment_type]: ['Ablation', 'Chemotherapy'],
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData(
          { [DonorSubmitterId]: newDonorRecords },
          { [DonorSubmitterId]: existingDonorMock },
        )
        .catch((err: any) => fail(err));

      const chemoTretmentInvalidErr: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.treatment_type,
        message: `The previously submitted treatment data for Radiation therapy will be deleted`,
        type: DataValidationErrors.DELETING_THERAPY,
        index: 0,
        info: {
          donorSubmitterId: 'AB10',
          deleted: ['Radiation therapy'],
          value: ['Ablation', 'Chemotherapy'],
        },
      };

      chai.expect(result.treatment.dataErrors.length).to.eq(0);
      chai.expect(result.treatment.dataWarnings[0]).to.deep.eq(chemoTretmentInvalidErr);
    });

    it('should detect invalid treatment for radiation', async () => {
      const existingDonorMock: Donor = stubs.validation.existingDonor01();
      const newDonorAB1Records = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.TREATMENT,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'T_02',
          [TreatmentFieldsEnum.treatment_type]: ['Ablation'],
          index: 0,
        },
      );
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.RADIATION,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'T_02',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ AB1: newDonorAB1Records }, { AB1: existingDonorMock })
        .catch((err: any) => fail(err));

      const chemoTretmentInvalidErr: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.submitter_treatment_id,
        message: `[Radiation] records can not be submitted for treatment types of [Ablation].`,
        type: DataValidationErrors.INCOMPATIBLE_PARENT_TREATMENT_TYPE,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          value: 'T_02',
          treatment_type: ['Ablation'],
          therapyType: ClinicalEntitySchemaNames.RADIATION,
        },
      };
      chai.expect(result.radiation.dataErrors.length).to.eq(1);
      chai.expect(result.radiation.dataErrors).to.deep.include(chemoTretmentInvalidErr);
    });

    it('should detect hormone therapy record for treatment', async () => {
      const existingDonorMock: Donor = stubs.validation.existingDonor01();
      const newDonorAB1Records = {};

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
        newDonorAB1Records,
        {
          [PrimaryDiagnosisFieldsEnum.submitter_donor_id]: 'AB2',
          [PrimaryDiagnosisFieldsEnum.program_id]: 'PEME-CA',
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.TREATMENT,
        newDonorAB1Records,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'T_02',
          [TreatmentFieldsEnum.treatment_type]: ['Hormonal therapy'],
          [PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]: 'PP-1',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ AB1: newDonorAB1Records }, { AB1: existingDonorMock })
        .catch((err: any) => fail(err));

      const hormoneTreatmentInvalidErr: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.treatment_type,
        message: `Treatments of type [Hormonal therapy] need a corresponding [hormone_therapy] record.`,
        type: DataValidationErrors.MISSING_THERAPY_DATA,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          value: ['Hormonal therapy'],
          therapyType: ClinicalEntitySchemaNames.HORMONE_THERAPY,
        },
      };
      chai.expect(result.treatment.dataErrors.length).to.eq(1);
      chai.expect(result.treatment.dataErrors).to.deep.include(hormoneTreatmentInvalidErr);
    });
    it('should error when Treatment treatment_start_interval is greater than Donor survival_time', async () => {
      const existingDonor = stubs.validation.existingDonor08();
      const submissionRecordsMap = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.TREATMENT,
        submissionRecordsMap,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'ICGC_0002',
          [ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.FOLLOW_UP]]: 'FLL1234',
          [ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.TREATMENT]]: 'T_02',
          [TreatmentFieldsEnum.treatment_type]: ['Chemotherapy'],
          [TreatmentFieldsEnum.submitter_primary_diagnosis_id]: 'P4',
          [TreatmentFieldsEnum.treatment_start_interval]: 40,
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ ICGC_0002: submissionRecordsMap }, { ICGC_0002: existingDonor })
        .catch((err: any) => fail(err));

      const error_1: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.treatment_start_interval,
        message: 'treatment_start_interval cannot be greater than FollowUp interval_of_followup.',
        type: DataValidationErrors.TREATMENT_TIME_CONFLICT,
        index: 0,
        info: {
          donorSubmitterId: 'ICGC_0002',
          value: 40,
        },
      };

      const error_2: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.treatment_start_interval,
        message: 'treatment_start_interval should be less than Donor survival_time.',
        type: DataValidationErrors.TREATMENT_DONOR_TIME_CONFLICT,
        index: 0,
        info: {
          donorSubmitterId: 'ICGC_0002',
          value: 40,
        },
      };

      chai.expect(result[ClinicalEntitySchemaNames.TREATMENT].dataErrors[0]).to.deep.eq(error_2);
      chai.expect(result[ClinicalEntitySchemaNames.TREATMENT].dataErrors[1]).to.deep.eq(error_1);
    });

    /**
     * Surgery Tests
     */
    it('should allow submitting surgeries with the same combo of submitter_donor_id and sumitter_treatment_id when surgery_type is the same ', async () => {
      const existingDonor = stubs.validation.existingDonor09();
      const submissionRecordsMap = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SURGERY,
        submissionRecordsMap,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'ICGC_0002',
          [SurgeryFieldsEnum.submitter_specimen_id]: 'sp-2',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'Tr-1',
          [SurgeryFieldsEnum.surgery_type]: 'Biopsy',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ ICGC_0002: submissionRecordsMap }, { ICGC_0002: existingDonor })
        .catch((err: any) => fail(err));

      chai.expect(result[ClinicalEntitySchemaNames.SURGERY].dataErrors.length).to.equal(0);
    });

    it('should error when multiple surgeries with the same submitter_specimen_id are found', async () => {
      const existingDonor = stubs.validation.existingDonor09();
      const submissionRecordsMap = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SURGERY,
        submissionRecordsMap,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'ICGC_0002',
          [SurgeryFieldsEnum.submitter_specimen_id]: 'sp-1',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'Tr-1',
          [SurgeryFieldsEnum.surgery_type]: 'Biopsy',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ ICGC_0002: submissionRecordsMap }, { ICGC_0002: existingDonor })
        .catch((err: any) => fail(err));

      const error: SubmissionValidationError = {
        fieldName: DonorFieldsEnum.submitter_donor_id,
        message:
          "The submitter_specimen_id 'sp-1' has already been associated with a surgery in the current or previous submission. Specimen can only be submitted once for a single surgery.",
        type: DataValidationErrors.DUPLICATE_SUBMITTER_SPECIMEN_ID_IN_SURGERY,
        index: 0,
        info: {
          submitter_specimen_id: 'sp-1',
          donorSubmitterId: 'ICGC_0002',
          value: 'ICGC_0002',
        },
      };

      chai.expect(result[ClinicalEntitySchemaNames.SURGERY].dataErrors.length).equal(1);
      chai.expect(result[ClinicalEntitySchemaNames.SURGERY].dataErrors[0]).to.deep.eq(error);
    });

    it('should error when two surgeries are associated with the same submitter_donor_id and submitter_treatment_id but different surgery_type.', async () => {
      const existingDonor = stubs.validation.existingDonor09();
      const submissionRecordsMap = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SURGERY,
        submissionRecordsMap,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'ICGC_0002',
          [SurgeryFieldsEnum.submitter_specimen_id]: 'sp-2',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'Tr-1',
          [SurgeryFieldsEnum.surgery_type]: 'Gastric Antrectomy',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ ICGC_0002: submissionRecordsMap }, { ICGC_0002: existingDonor })
        .catch((err: any) => fail(err));

      const error: SubmissionValidationError = {
        fieldName: SurgeryFieldsEnum.submitter_specimen_id,
        message:
          "The combination of submitter_donor_id 'ICGC_0002' and submitter_treatment_id 'Tr-1' can only be associated with one surgery_type. Please correct your data submission.",
        type: DataValidationErrors.SURGERY_TYPES_NOT_EQUAL,
        index: 0,
        info: {
          donorSubmitterId: 'ICGC_0002',
          submitter_donor_id: 'ICGC_0002',
          submitter_treatment_id: 'Tr-1',
          surgery_type: 'Gastric Antrectomy',
          value: 'sp-2',
        },
      };

      chai.expect(result[ClinicalEntitySchemaNames.SURGERY].dataErrors.length).equal(1);
      chai.expect(result[ClinicalEntitySchemaNames.SURGERY].dataErrors[0]).to.deep.eq(error);
    });

    it('should error when submitter_specimen_id is not submitted, two surgeries are associated with the same submitter_donor_id and submitter_treatment_id', async () => {
      const existingDonor = stubs.validation.existingDonor09();
      const submissionRecordsMap = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.SURGERY,
        submissionRecordsMap,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'ICGC_0002',
          [TreatmentFieldsEnum.submitter_treatment_id]: 'Tr-1',
          [SurgeryFieldsEnum.surgery_type]: 'Gastric Antrectomy',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ ICGC_0002: submissionRecordsMap }, { ICGC_0002: existingDonor })
        .catch((err: any) => fail(err));

      const error: SubmissionValidationError = {
        fieldName: DonorFieldsEnum.submitter_donor_id,
        message:
          "When submitter_specimen_id is not submitted, the combination of [submitter_donor_id = 'ICGC_0002' and submitter_treatment_id = 'Tr-1' ] should only be submitted once in the Surgery schema. Please correct your data submission.",
        type: DataValidationErrors.DUPLICATE_SURGERY_WHEN_SPECIMEN_NOT_SUBMITTED,
        index: 0,
        info: {
          submitter_donor_id: 'ICGC_0002',
          submitter_treatment_id: 'Tr-1',
          donorSubmitterId: 'ICGC_0002',
          value: 'ICGC_0002',
        },
      };

      chai.expect(result[ClinicalEntitySchemaNames.SURGERY].dataErrors.length).equal(1);
      chai.expect(result[ClinicalEntitySchemaNames.SURGERY].dataErrors[0]).to.deep.eq(error);
    });
  });

  describe('follow up validation', () => {
    it('should detect follow up belongs to other donor', async () => {
      const donorOwnsTheFollowupAlready = stubs.validation.existingDonor05();
      donorDaoFindByClinicalEntitySubmitterIdAndProgramIdStub.returns(
        Promise.resolve<Donor>(donorOwnsTheFollowupAlready),
      );
      const donorToAddFollowupTo: Donor = stubs.validation.existingDonor01();

      const submissionRecordsMap = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.FOLLOW_UP,
        submissionRecordsMap,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'AB1',
          [ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.FOLLOW_UP]]: 'FF123',
          some_field: 'asdasd',
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ AB1: submissionRecordsMap }, { AB1: donorToAddFollowupTo })
        .catch((err: any) => fail(err));

      chai.expect(result[ClinicalEntitySchemaNames.FOLLOW_UP].dataErrors.length).to.eq(2);
      const followUpError_1: SubmissionValidationError = {
        fieldName: FollowupFieldsEnum.submitter_follow_up_id,
        message: `This follow up has already been associated to donor AB2. Please correct your file.`,
        type: DataValidationErrors.CLINICAL_ENTITY_BELONGS_TO_OTHER_DONOR,
        index: 0,
        info: {
          clinicalType: ClinicalEntitySchemaNames.FOLLOW_UP,
          donorSubmitterId: 'AB1',
          value: 'FF123',
          otherDonorSubmitterId: 'AB2',
        },
      };

      const followUpError_2: SubmissionValidationError = {
        fieldName: FollowupFieldsEnum.interval_of_followup,
        message: `[interval_of_followup] requires [donor.vital_status], [donor.survival_time] in order to complete validation. Please upload data for all fields in this clinical data submission.`,
        type: DataValidationErrors.NOT_ENOUGH_INFO_TO_VALIDATE,
        index: 0,
        info: {
          donorSubmitterId: 'AB1',
          value: undefined,
          missingField: ['donor.vital_status', 'donor.survival_time'],
        },
      };
      chai
        .expect(result[ClinicalEntitySchemaNames.FOLLOW_UP].dataErrors[0])
        .to.deep.eq(followUpError_2);

      chai
        .expect(result[ClinicalEntitySchemaNames.FOLLOW_UP].dataErrors[1])
        .to.deep.eq(followUpError_1);
    });
    it('should get followup error when follow up interval_of_followup is less than Treatment treatment_start_interval', async () => {
      const existingDonor = stubs.validation.existingDonor08();
      const submissionRecordsMap = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.FOLLOW_UP,
        submissionRecordsMap,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'ICGC_0002',
          [ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.FOLLOW_UP]]: 'FLL1234',
          [ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.TREATMENT]]: 'T_02',
          interval_of_followup: 10,
          index: 0,
        },
      );

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.FOLLOW_UP,
        submissionRecordsMap,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'ICGC_0002',
          [ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.FOLLOW_UP]]: 'FLL1235',
          [ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.TREATMENT]]: 'T_02',
          interval_of_followup: 3,
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ ICGC_0002: submissionRecordsMap }, { ICGC_0002: existingDonor })
        .catch((err: any) => fail(err));

      const error_1: SubmissionValidationError = {
        fieldName: FollowupFieldsEnum.interval_of_followup,
        message: 'interval_of_followup must be less than Donor survival_time.',
        type: DataValidationErrors.FOLLOW_UP_DONOR_TIME_CONFLICT,
        index: 0,
        info: {
          donorSubmitterId: 'ICGC_0002',
          value: 10,
        },
      };

      const error_2: SubmissionValidationError = {
        fieldName: FollowupFieldsEnum.interval_of_followup,
        message: 'interval_of_followup cannot be less than Treatment treatment_start_interval.',
        type: DataValidationErrors.FOLLOW_UP_CONFLICING_INTERVAL,
        index: 0,
        info: {
          donorSubmitterId: 'ICGC_0002',
          value: 3,
        },
      };

      chai.expect(result[ClinicalEntitySchemaNames.FOLLOW_UP].dataErrors[0]).to.deep.eq(error_1);
      chai.expect(result[ClinicalEntitySchemaNames.FOLLOW_UP].dataErrors[1]).to.deep.eq(error_2);
    });
    it('should get treatment error when Treatment treatment_start_interval is geater than Followup interval_of_followup', async () => {
      const existingDonor = stubs.validation.existingDonor08();
      const submissionRecordsMap = {};
      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.TREATMENT,
        submissionRecordsMap,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'ICGC_0002',
          [ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.FOLLOW_UP]]: 'FLL1234',
          [ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.TREATMENT]]: 'T_02',
          [TreatmentFieldsEnum.treatment_type]: ['Chemotherapy'],
          [TreatmentFieldsEnum.submitter_primary_diagnosis_id]: 'P4',
          [TreatmentFieldsEnum.treatment_start_interval]: 50,
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ ICGC_0002: submissionRecordsMap }, { ICGC_0002: existingDonor })
        .catch((err: any) => fail(err));

      const error_1: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.treatment_start_interval,
        message: 'treatment_start_interval should be less than Donor survival_time.',
        type: DataValidationErrors.TREATMENT_DONOR_TIME_CONFLICT,
        index: 0,
        info: {
          donorSubmitterId: 'ICGC_0002',
          value: 50,
        },
      };

      const error_2: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.treatment_start_interval,
        message: 'treatment_start_interval cannot be greater than FollowUp interval_of_followup.',
        type: DataValidationErrors.TREATMENT_TIME_CONFLICT,
        index: 0,
        info: {
          donorSubmitterId: 'ICGC_0002',
          value: 50,
        },
      };

      const error_3: SubmissionValidationError = {
        fieldName: TreatmentFieldsEnum.treatment_start_interval,
        message: 'treatment_start_interval cannot be greater than FollowUp interval_of_followup.',
        type: DataValidationErrors.TREATMENT_TIME_CONFLICT,
        index: 0,
        info: {
          donorSubmitterId: 'ICGC_0002',
          value: 50,
        },
      };

      chai.expect(result[ClinicalEntitySchemaNames.TREATMENT].dataErrors[0]).to.deep.eq(error_1);
      chai.expect(result[ClinicalEntitySchemaNames.TREATMENT].dataErrors[1]).to.deep.eq(error_2);
      chai.expect(result[ClinicalEntitySchemaNames.TREATMENT].dataErrors[1]).to.deep.eq(error_3);
    });
    it('should get followup error when follow up interval_of_followup is greater than Donor survival_time.', async () => {
      const existingDonor = stubs.validation.existingDonor08();
      const submissionRecordsMap = {};

      ClinicalSubmissionRecordsOperations.addRecord(
        ClinicalEntitySchemaNames.FOLLOW_UP,
        submissionRecordsMap,
        {
          [SampleRegistrationFieldsEnum.submitter_donor_id]: 'ICGC_0002',
          [ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.FOLLOW_UP]]: 'FLL1234',
          [ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.TREATMENT]]: 'T_02',
          interval_of_followup: 10,
          index: 0,
        },
      );

      const result = await dv
        .validateSubmissionData({ ICGC_0002: submissionRecordsMap }, { ICGC_0002: existingDonor })
        .catch((err: any) => fail(err));

      const followUpError: SubmissionValidationError = {
        fieldName: FollowupFieldsEnum.interval_of_followup,
        message: 'interval_of_followup must be less than Donor survival_time.',
        type: DataValidationErrors.FOLLOW_UP_DONOR_TIME_CONFLICT,
        index: 0,
        info: {
          donorSubmitterId: 'ICGC_0002',
          value: 10,
        },
      };

      chai
        .expect(result[ClinicalEntitySchemaNames.FOLLOW_UP].dataErrors[0])
        .to.deep.eq(followUpError);
    });
  });
});
