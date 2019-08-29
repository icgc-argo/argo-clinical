import chai from "chai";
import sinon from "sinon";
import { donorDao } from "../../../src/clinical/donor-repo";
import * as dv from "../../../src/submission/validation";
import {
  SubmissionValidationError,
  DataValidationErrors,
  CreateRegistrationRecord,
  FieldsEnum
} from "../../../src/submission/submission-entities";
import { Donor } from "../../../src/clinical/clinical-entities";
import { stubs } from "./stubs";
import { FileType } from "../../../src/submission/submission-api";

const genderMutatedErr: SubmissionValidationError = {
  fieldName: "gender",
  index: 0,
  info: {
    donorSubmitterId: "AB1",
    sampleSubmitterId: "AM1",
    specimenSubmitterId: "SP1",
    value: "Male"
  },
  type: DataValidationErrors.MUTATING_EXISTING_DATA
};
const programInvalidErr: SubmissionValidationError = {
  fieldName: "program_id",
  index: 0,
  info: {
    expectedProgram: "PEME-CA",
    donorSubmitterId: "AB1",
    specimenSubmitterId: "SP1",
    sampleSubmitterId: "AM1",
    value: "PEM-CA"
  },
  type: DataValidationErrors.INVALID_PROGRAM_ID
};
const specimenMutatedErr: SubmissionValidationError = {
  fieldName: "specimen_type",
  index: 0,
  info: {
    donorSubmitterId: "AB1",
    specimenSubmitterId: "SP1",
    sampleSubmitterId: "AM1",
    value: "XYZ1"
  },
  type: DataValidationErrors.MUTATING_EXISTING_DATA
};
const tndError: SubmissionValidationError = {
  fieldName: "tumour_normal_designation",
  index: 0,
  info: {
    donorSubmitterId: "AB1",
    specimenSubmitterId: "SP1",
    sampleSubmitterId: "AM1",
    value: "Normal2"
  },
  type: DataValidationErrors.MUTATING_EXISTING_DATA
};

const sampleTypeMutatedError: SubmissionValidationError = {
  fieldName: "sample_type",
  index: 0,
  info: {
    donorSubmitterId: "AB1",
    specimenSubmitterId: "SP1",
    sampleSubmitterId: "AM1",
    value: "ST11"
  },
  type: DataValidationErrors.MUTATING_EXISTING_DATA
};

const specimenBelongsToOtherDonor: SubmissionValidationError = {
  fieldName: FieldsEnum.submitter_specimen_id,
  index: 0,
  info: {
    donorSubmitterId: "AB2",
    specimenSubmitterId: "SP1",
    sampleSubmitterId: "AM1",
    value: "SP1"
  },
  type: DataValidationErrors.SPECIMEN_BELONGS_TO_OTHER_DONOR
};

const sampleBelongsToOtherSpecimenAB2: SubmissionValidationError = {
  fieldName: FieldsEnum.submitter_sample_id,
  index: 0,
  info: {
    donorSubmitterId: "AB2",
    specimenSubmitterId: "SP2",
    sampleSubmitterId: "AM1",
    value: "AM1"
  },
  type: DataValidationErrors.SAMPLE_BELONGS_TO_OTHER_SPECIMEN
};

const sampleBelongsToOtherSpecimenAB1: SubmissionValidationError = {
  fieldName: FieldsEnum.submitter_sample_id,
  index: 0,
  info: {
    donorSubmitterId: "AB1",
    specimenSubmitterId: "SP2",
    sampleSubmitterId: "AM1",
    value: "AM1"
  },
  type: DataValidationErrors.SAMPLE_BELONGS_TO_OTHER_SPECIMEN
};

describe("data-validator", () => {
  let donorDaoCountByStub: sinon.SinonStub;
  let donorDaoFindBySpecimenSubmitterIdAndProgramIdStub: sinon.SinonStub;
  let donorDaoFindBySampleSubmitterIdAndProgramIdStub: sinon.SinonStub;
  beforeEach(done => {
    donorDaoCountByStub = sinon.stub(donorDao, "countBy");
    donorDaoFindBySpecimenSubmitterIdAndProgramIdStub = sinon.stub(
      donorDao,
      "findBySpecimenSubmitterIdAndProgramId"
    );
    donorDaoFindBySampleSubmitterIdAndProgramIdStub = sinon.stub(
      donorDao,
      "findBySampleSubmitterIdAndProgramId"
    );
    done();
  });

  afterEach(done => {
    donorDaoCountByStub.restore();
    donorDaoFindBySpecimenSubmitterIdAndProgramIdStub.restore();
    donorDaoFindBySampleSubmitterIdAndProgramIdStub.restore();
    done();
  });
  it("should detect invalid program id", async () => {
    donorDaoCountByStub.returns(Promise.resolve(0));
    // test call
    const result = await dv.usingInvalidProgramId(
      FileType.REGISTRATION,
      0,
      {
        submitter_donor_id: "AB1",
        gender: "Male",
        program_id: "PEM-CA",
        submitter_sample_id: "AM1",
        specimen_type: "XYZ",
        sample_type: "ST1",
        submitter_specimen_id: "SP1",
        tumour_normal_designation: "Normal"
      },
      "PEME-CA"
    );

    // assertions
    chai.expect(result.length).to.eq(1);
    chai.expect(result[0]).to.deep.eq(programInvalidErr);
  });

  it("should detect gender update", async () => {
    donorDaoCountByStub.returns(Promise.resolve(0));
    const existingDonorMock: Donor = stubs.validation.existingDonor01();

    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB1",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST1",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        }
      ],
      { AB1: existingDonorMock }
    );

    // assertions
    chai.expect(result.errors.length).to.eq(1);
    chai.expect(result.errors[0]).to.deep.eq(genderMutatedErr);
  });

  it("should detect specimen type update", async () => {
    donorDaoCountByStub.returns(Promise.resolve(0));
    const existingDonorMock: Donor = stubs.validation.existingDonor01();

    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB1",
          gender: "Female",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ1",
          sampleType: "ST1",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        }
      ],
      { AB1: existingDonorMock }
    );

    // assertions
    chai.expect(result.errors.length).to.eq(1);
    chai.expect(result.errors[0]).to.deep.eq(specimenMutatedErr);
  });

  it("should detect tumourNormalDesignation update", async () => {
    donorDaoCountByStub.returns(Promise.resolve(0));
    const existingDonorMock: Donor = stubs.validation.existingDonor01();

    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB1",
          gender: "Female",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST1",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal2"
        }
      ],
      { AB1: existingDonorMock }
    );

    // assertions
    chai.expect(result.errors.length).to.eq(1);
    chai.expect(result.errors[0]).to.deep.eq(tndError);
  });

  it("should detect sampleType update", async () => {
    donorDaoCountByStub.returns(Promise.resolve(0));
    const existingDonorMock: Donor = stubs.validation.existingDonor01();

    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB1",
          gender: "Female",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        }
      ],
      { AB1: existingDonorMock }
    );

    // assertions
    chai.expect(result.errors.length).to.eq(1);
    chai.expect(result.errors[0]).to.deep.eq(sampleTypeMutatedError);
  });

  it("should detect sampleType, specimenType,tnd, gender update togather", async () => {
    donorDaoCountByStub.returns(Promise.resolve(0));
    const existingDonorMock: Donor = stubs.validation.existingDonor01();
    const valid2ndRecord: CreateRegistrationRecord = {
      donorSubmitterId: "AB11",
      gender: "Male",
      programId: "PEME-CA",
      sampleSubmitterId: "AM13",
      specimenType: "XYZ1",
      sampleType: "S",
      specimenSubmitterId: "RR",
      tumourNormalDesignation: "Normal"
    };
    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB1",
          gender: "Male",
          programId: "PEM-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZQ",
          sampleType: "ST11",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal2"
        },
        valid2ndRecord
      ],
      { AB1: existingDonorMock }
    );

    // assertions
    chai.expect(result.errors.length).to.eq(4);
    chai.expect(result.errors).to.deep.include(sampleTypeMutatedError);
    const specimenMutatedError: SubmissionValidationError = {
      fieldName: "specimen_type",
      index: 0,
      info: {
        donorSubmitterId: "AB1",
        specimenSubmitterId: "SP1",
        sampleSubmitterId: "AM1",
        value: "XYZQ"
      },
      type: DataValidationErrors.MUTATING_EXISTING_DATA
    };
    chai.expect(result.errors).to.deep.include(specimenMutatedError);
    chai.expect(result.errors).to.deep.include(tndError);
    chai.expect(result.errors).to.deep.include(genderMutatedErr);
  });

  it("should detect specimen belongs to other donor", async () => {
    donorDaoCountByStub
      .onFirstCall()
      .returns(Promise.resolve(1))
      .onSecondCall()
      .returns(Promise.resolve(0));

    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB2",
          gender: "Female",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        }
      ],
      {}
    );

    // assertions
    chai.expect(result.errors.length).to.eq(1);
    chai.expect(result.errors[0]).to.deep.eq(specimenBelongsToOtherDonor);
  });

  // see issue https://github.com/icgc-argo/argo-clinical/issues/112
  it("should detect specimen belongs to other donor and specimen type changed", async () => {
    donorDaoFindBySampleSubmitterIdAndProgramIdStub.returns(
      Promise.resolve(stubs.validation.existingDonor03())
    );

    donorDaoFindBySpecimenSubmitterIdAndProgramIdStub.returns(
      Promise.resolve<Donor>(stubs.validation.existingDonor02())
    );

    donorDaoCountByStub
      .onFirstCall()
      .returns(Promise.resolve(1))
      .onSecondCall()
      .returns(Promise.resolve(0));

    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB2",
          gender: "Female",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        },
        {
          donorSubmitterId: "AB3",
          gender: "Female",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SPY",
          tumourNormalDesignation: "Normal"
        }
      ],
      {}
    );

    const specimenTypeMutatedErr: SubmissionValidationError = {
      fieldName: "specimen_type",
      index: 0,
      info: {
        donorSubmitterId: "AB2",
        specimenSubmitterId: "SP1",
        sampleSubmitterId: "AM1",
        value: "XYZ"
      },
      type: DataValidationErrors.MUTATING_EXISTING_DATA
    };

    const sampleTypeMutatedErr: SubmissionValidationError = {
      fieldName: "sample_type",
      index: 1,
      info: {
        donorSubmitterId: "AB3",
        specimenSubmitterId: "SPY",
        sampleSubmitterId: "AM1",
        value: "ST11"
      },
      type: DataValidationErrors.MUTATING_EXISTING_DATA
    };

    // assertions
    chai.expect(result.errors.length).to.eq(3);
    chai.expect(result.errors[0]).to.deep.eq(specimenTypeMutatedErr);
    chai.expect(result.errors[1]).to.deep.eq(specimenBelongsToOtherDonor);
    chai.expect(result.errors[2]).to.deep.eq(sampleTypeMutatedErr);
  });

  it("should detect sample belongs to other specimen, same donor", async () => {
    donorDaoCountByStub
      .onFirstCall()
      .returns(Promise.resolve(0))
      .onSecondCall()
      .returns(Promise.resolve(1));
    const existingDonorMock: Donor = stubs.validation.existingDonor01();
    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB1",
          gender: "Female",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP2",
          tumourNormalDesignation: "Normal"
        }
      ],
      { AB1: existingDonorMock }
    );

    // assertions
    chai.expect(result.errors.length).to.eq(1);
    chai.expect(result.errors[0]).to.deep.eq(sampleBelongsToOtherSpecimenAB1);
  });

  it("should detect sample belongs to other specimen, different donor", async () => {
    donorDaoCountByStub
      .onFirstCall()
      .returns(Promise.resolve(0))
      .onSecondCall()
      .returns(Promise.resolve(1));
    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB2",
          gender: "Female",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP2",
          tumourNormalDesignation: "Normal"
        }
      ],
      {}
    );

    // assertions
    chai.expect(result.errors.length).to.eq(1);
    chai.expect(result.errors[0]).to.deep.eq(sampleBelongsToOtherSpecimenAB2);
  });

  // different donor different specimen same sample id
  it("should detect sample id conflict between new registrations", async () => {
    donorDaoCountByStub.returns(Promise.resolve(0));
    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB1",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP2",
          tumourNormalDesignation: "Normal"
        },
        {
          donorSubmitterId: "AB2",
          gender: "Female",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        }
      ],
      {}
    );

    // assertions
    const row0Err = {
      fieldName: FieldsEnum.submitter_sample_id,
      index: 0,
      info: {
        conflictingRows: [1],
        donorSubmitterId: "AB1",
        sampleSubmitterId: "AM1",
        specimenSubmitterId: "SP2",
        value: "AM1"
      },
      type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT
    };

    const row1Err = {
      fieldName: FieldsEnum.submitter_sample_id,
      index: 1,
      info: {
        conflictingRows: [0],
        donorSubmitterId: "AB2",
        sampleSubmitterId: "AM1",
        specimenSubmitterId: "SP1",
        value: "AM1"
      },
      type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT
    };

    chai.expect(result.errors.length).to.eq(2);
    chai.expect(result.errors).to.deep.include(row0Err);
    chai.expect(result.errors).to.deep.include(row1Err);
  });

  // different donors & samples same specimen Id
  it("should detect specimen conflict between new registrations", async () => {
    donorDaoCountByStub.returns(Promise.resolve(0));
    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB1",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        },
        // dummy ok row to make sure indexes detected correctly
        {
          donorSubmitterId: "AB3",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM4",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP4",
          tumourNormalDesignation: "Normal"
        },
        {
          donorSubmitterId: "AB2",
          gender: "Female",
          programId: "PEME-CA",
          sampleSubmitterId: "AM2",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        }
      ],
      {}
    );

    // assertions
    const row0Err = {
      fieldName: FieldsEnum.submitter_specimen_id,
      index: 0,
      info: {
        conflictingRows: [2],
        donorSubmitterId: "AB1",
        sampleSubmitterId: "AM1",
        specimenSubmitterId: "SP1",
        value: "SP1"
      },
      type: DataValidationErrors.NEW_SPECIMEN_ID_CONFLICT
    };

    const row2Err = {
      fieldName: FieldsEnum.submitter_specimen_id,
      index: 2,
      info: {
        conflictingRows: [0],
        donorSubmitterId: "AB2",
        sampleSubmitterId: "AM2",
        specimenSubmitterId: "SP1",
        value: "SP1"
      },
      type: DataValidationErrors.NEW_SPECIMEN_ID_CONFLICT
    };

    chai.expect(result.errors.length).to.eq(2);
    chai.expect(result.errors).to.deep.include(row0Err);
    chai.expect(result.errors).to.deep.include(row2Err);
  });

  // same donor same specimen different specimen type
  it("should detect specimen type conflict for same new donor", async () => {
    donorDaoCountByStub.returns(Promise.resolve(0));
    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB1",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYX",
          sampleType: "ST11",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        },
        // dummy ok row to make sure indexes detected correctly
        {
          donorSubmitterId: "AB3",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM4",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP4",
          tumourNormalDesignation: "Normal"
        },
        {
          donorSubmitterId: "AB1",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM2",
          specimenType: "XYz",
          sampleType: "ST11",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        }
      ],
      {}
    );

    // assertions
    const row0Err: SubmissionValidationError = {
      fieldName: "specimen_type",
      index: 0,
      info: {
        donorSubmitterId: "AB1",
        sampleSubmitterId: "AM1",
        specimenSubmitterId: "SP1",
        value: "XYX",
        conflictingRows: [2]
      },
      type: DataValidationErrors.NEW_SPECIMEN_ATTR_CONFLICT
    };

    const row2Err: SubmissionValidationError = {
      fieldName: "specimen_type",
      index: 2,
      info: {
        donorSubmitterId: "AB1",
        sampleSubmitterId: "AM2",
        specimenSubmitterId: "SP1",
        value: "XYz",
        conflictingRows: [0]
      },
      type: DataValidationErrors.NEW_SPECIMEN_ATTR_CONFLICT
    };

    chai.expect(result.errors.length).to.eq(2);
    chai.expect(result.errors).to.deep.include(row0Err);
    chai.expect(result.errors).to.deep.include(row2Err);
  });

  // same donor same specimen different specimen type
  it("should detect sample type conflict for same new specimen & sample Id", async () => {
    donorDaoCountByStub.returns(Promise.resolve(0));
    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB1",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST-2",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        },
        // dummy ok row to make sure indexes detected correctly
        {
          donorSubmitterId: "AB3",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM4",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP4",
          tumourNormalDesignation: "Normal"
        },
        {
          donorSubmitterId: "AB1",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST2",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        }
      ],
      {}
    );

    // assertions
    const row0Err: SubmissionValidationError = {
      fieldName: "sample_type",
      index: 0,
      info: {
        donorSubmitterId: "AB1",
        sampleSubmitterId: "AM1",
        specimenSubmitterId: "SP1",
        value: "ST-2",
        conflictingRows: [2]
      },
      type: DataValidationErrors.NEW_SAMPLE_ATTR_CONFLICT
    };

    const row2Err: SubmissionValidationError = {
      fieldName: "sample_type",
      index: 2,
      info: {
        donorSubmitterId: "AB1",
        sampleSubmitterId: "AM1",
        specimenSubmitterId: "SP1",
        value: "ST2",
        conflictingRows: [0]
      },
      type: DataValidationErrors.NEW_SAMPLE_ATTR_CONFLICT
    };

    chai.expect(result.errors.length).to.eq(2);
    chai.expect(result.errors).to.deep.include(row0Err);
    chai.expect(result.errors).to.deep.include(row2Err);
  });

  it("should detect gender conflict in new donors", async () => {
    donorDaoCountByStub.returns(Promise.resolve(0));
    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB1",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST-2",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        },
        // dummy ok row to make sure indexes detected correctly
        {
          donorSubmitterId: "AB3",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM4",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP4",
          tumourNormalDesignation: "Normal"
        },
        {
          donorSubmitterId: "AB1",
          gender: "Female",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST-2",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        }
      ],
      {}
    );

    // assertions
    const row0Err: SubmissionValidationError = {
      fieldName: "gender",
      index: 0,
      info: {
        donorSubmitterId: "AB1",
        sampleSubmitterId: "AM1",
        specimenSubmitterId: "SP1",
        value: "Male",
        conflictingRows: [2]
      },
      type: DataValidationErrors.NEW_DONOR_CONFLICT
    };

    const row2Err: SubmissionValidationError = {
      fieldName: "gender",
      index: 2,
      info: {
        donorSubmitterId: "AB1",
        sampleSubmitterId: "AM1",
        specimenSubmitterId: "SP1",
        value: "Female",
        conflictingRows: [0]
      },
      type: DataValidationErrors.NEW_DONOR_CONFLICT
    };

    chai.expect(result.errors.length).to.eq(2);
    chai.expect(result.errors).to.deep.include(row0Err);
    chai.expect(result.errors).to.deep.include(row2Err);
  });

  it("should detect sample id conflict for same donor & different specimen Id", async () => {
    donorDaoCountByStub.returns(Promise.resolve(0));
    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB1",
          gender: "Female",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST2",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        },
        // dummy ok row to make sure indexes detected correctly
        {
          donorSubmitterId: "AB3",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM4",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP4",
          tumourNormalDesignation: "Normal"
        },
        {
          donorSubmitterId: "AB1",
          gender: "Female",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST2",
          specimenSubmitterId: "SP2",
          tumourNormalDesignation: "Normal"
        }
      ],
      {}
    );

    // assertions
    const row0Err: SubmissionValidationError = {
      fieldName: FieldsEnum.submitter_sample_id,
      index: 0,
      info: {
        donorSubmitterId: "AB1",
        sampleSubmitterId: "AM1",
        specimenSubmitterId: "SP1",
        value: "AM1",
        conflictingRows: [2]
      },
      type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT
    };

    const row2Err: SubmissionValidationError = {
      fieldName: FieldsEnum.submitter_sample_id,
      index: 2,
      info: {
        donorSubmitterId: "AB1",
        sampleSubmitterId: "AM1",
        specimenSubmitterId: "SP2",
        value: "AM1",
        conflictingRows: [0]
      },
      type: DataValidationErrors.NEW_SAMPLE_ID_CONFLICT
    };

    chai.expect(result.errors.length).to.eq(2);
    chai.expect(result.errors).to.deep.include(row0Err);
    chai.expect(result.errors).to.deep.include(row2Err);
  });

  it("should detect sample type conflict for same new specimen & sample Id", async () => {
    donorDaoCountByStub.returns(Promise.resolve(0));
    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB1",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST-2",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        },
        // dummy ok row to make sure indexes detected correctly
        {
          donorSubmitterId: "AB3",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM4",
          specimenType: "XYZ",
          sampleType: "ST11",
          specimenSubmitterId: "SP4",
          tumourNormalDesignation: "Normal"
        },
        {
          donorSubmitterId: "AB1",
          gender: "Male",
          programId: "PEME-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST2",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        }
      ],
      {}
    );

    // assertions
    const row0Err: SubmissionValidationError = {
      fieldName: "sample_type",
      index: 0,
      info: {
        donorSubmitterId: "AB1",
        sampleSubmitterId: "AM1",
        specimenSubmitterId: "SP1",
        value: "ST-2",
        conflictingRows: [2]
      },
      type: DataValidationErrors.NEW_SAMPLE_ATTR_CONFLICT
    };

    const row2Err = {
      fieldName: "sample_type",
      index: 2,
      info: {
        donorSubmitterId: "AB1",
        sampleSubmitterId: "AM1",
        specimenSubmitterId: "SP1",
        value: "ST2",
        conflictingRows: [0]
      },
      type: DataValidationErrors.NEW_SAMPLE_ATTR_CONFLICT
    };

    chai.expect(result.errors.length).to.eq(2);
    chai.expect(result.errors).to.deep.include(row0Err);
    chai.expect(result.errors).to.deep.include(row2Err);
  });
});
