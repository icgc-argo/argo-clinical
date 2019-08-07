import chai from "chai";
import sinon from "sinon";
import { donorDao } from "../../../src/clinical/donor-repo";
import * as dv from "../../../src/submission/validation";
import {
  RegistrationValidationError,
  DataValidationErrors,
  CreateRegistrationRecord
} from "../../../src/submission/submission-entities";
import { Donor } from "../../../src/clinical/clinical-entities";
import { stubs } from "./stubs";

const donorDaoCountByStub = sinon.stub(donorDao, "countBy");

const genderMutatedErr: RegistrationValidationError = {
  fieldName: "gender",
  index: 0,
  donorSubmitterId: "AB1",
  info: {},
  type: DataValidationErrors.MUTATING_EXISTING_DATA
};
const programInvalidErr: RegistrationValidationError = {
  fieldName: "program_id",
  index: 0,
  donorSubmitterId: "AB1",
  info: { expectedProgram: "PEME-CA" },
  type: DataValidationErrors.INVALID_PROGRAM_ID
};
const specimenMutatedErr: RegistrationValidationError = {
  fieldName: "specimen_type",
  index: 0,
  donorSubmitterId: "AB1",
  info: {},
  type: DataValidationErrors.MUTATING_EXISTING_DATA
};
const tndError: RegistrationValidationError = {
  fieldName: "tumour_normal_designation",
  index: 0,
  info: {},
  donorSubmitterId: "AB1",
  type: DataValidationErrors.MUTATING_EXISTING_DATA
};

const sampleTypeMutatedError: RegistrationValidationError = {
  fieldName: "sample_type",
  index: 0,
  donorSubmitterId: "AB1",
  info: {},
  type: DataValidationErrors.MUTATING_EXISTING_DATA
};

const specimenBelongsToOtherDonor: RegistrationValidationError = {
  fieldName: "specimen_submitter_id",
  index: 0,
  donorSubmitterId: "AB2",
  info: {},
  type: DataValidationErrors.SPECIMEN_BELONGS_TO_OTHER_DONOR
};

const sampleBelongsToOtherSpecimenAB2: RegistrationValidationError = {
  fieldName: "sample_submitter_id",
  index: 0,
  donorSubmitterId: "AB2",
  info: {},
  type: DataValidationErrors.SAMPLE_BELONGS_TO_OTHER_SPECIMEN
};

const sampleBelongsToOtherSpecimenAB1: RegistrationValidationError = {
  fieldName: "sample_submitter_id",
  index: 0,
  donorSubmitterId: "AB1",
  info: {},
  type: DataValidationErrors.SAMPLE_BELONGS_TO_OTHER_SPECIMEN
};

describe("data-validator", () => {
  beforeEach(done => {
    donorDaoCountByStub.reset();
    done();
  });

  it("should detect invalid program id", async () => {
    donorDaoCountByStub.returns(Promise.resolve(0));
    // test call
    const result = await dv.usingInvalidProgramId(
      0,
      {
        donorSubmitterId: "AB1",
        gender: "Male",
        program_id: "PEM-CA",
        sampleSubmitterId: "AM1",
        specimenType: "XYZ",
        sampleType: "ST1",
        specimenSubmitterId: "SP1",
        tumourNormalDesignation: "Normal"
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
      specimenType: "X",
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
    chai.expect(result.errors).to.deep.include(specimenMutatedErr);
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
      fieldName: "sample_submitter_id",
      index: 0,
      donorSubmitterId: "AB1",
      info: {
        conflictingRows: [1]
      },
      type: DataValidationErrors.NEW_SAMPLE_CONFLICT
    };

    const row1Err = {
      fieldName: "sample_submitter_id",
      index: 1,
      donorSubmitterId: "AB2",
      info: {
        conflictingRows: [0]
      },
      type: DataValidationErrors.NEW_SAMPLE_CONFLICT
    };

    chai.expect(result.errors.length).to.eq(2);
    chai.expect(result.errors[0]).to.deep.eq(row0Err);
    chai.expect(result.errors[1]).to.deep.eq(row1Err);
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
      fieldName: "specimen_submitter_id",
      index: 0,
      donorSubmitterId: "AB1",
      info: {
        conflictingRows: [2]
      },
      type: DataValidationErrors.NEW_SPECIMEN_CONFLICT
    };

    const row2Err = {
      fieldName: "specimen_submitter_id",
      index: 2,
      donorSubmitterId: "AB2",
      info: {
        conflictingRows: [0]
      },
      type: DataValidationErrors.NEW_SPECIMEN_CONFLICT
    };

    chai.expect(result.errors.length).to.eq(2);
    chai.expect(result.errors[0]).to.deep.eq(row0Err);
    chai.expect(result.errors[1]).to.deep.eq(row2Err);
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
          gender: "Female",
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
    const row0Err: RegistrationValidationError = {
      fieldName: "specimen_type",
      index: 0,
      donorSubmitterId: "AB1",
      info: {
        conflictingRows: [2]
      },
      type: DataValidationErrors.NEW_SPECIMEN_CONFLICT
    };

    const row2Err: RegistrationValidationError = {
      fieldName: "specimen_type",
      index: 2,
      donorSubmitterId: "AB1",
      info: {
        conflictingRows: [0]
      },
      type: DataValidationErrors.NEW_SPECIMEN_CONFLICT
    };

    chai.expect(result.errors.length).to.eq(2);
    chai.expect(result.errors[0]).to.deep.eq(row0Err);
    chai.expect(result.errors[1]).to.deep.eq(row2Err);
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
          gender: "Female",
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
    const row0Err: RegistrationValidationError = {
      fieldName: "sample_type",
      index: 0,
      donorSubmitterId: "AB1",
      info: {
        conflictingRows: [2]
      },
      type: DataValidationErrors.NEW_SAMPLE_CONFLICT
    };

    const row2Err: RegistrationValidationError = {
      fieldName: "sample_type",
      index: 2,
      donorSubmitterId: "AB1",
      info: {
        conflictingRows: [0]
      },
      type: DataValidationErrors.NEW_SAMPLE_CONFLICT
    };

    chai.expect(result.errors.length).to.eq(2);
    chai.expect(result.errors[0]).to.deep.eq(row0Err);
    chai.expect(result.errors[1]).to.deep.eq(row2Err);
  });

  it("should detect specimen id conflict for same donor & sample Id", async () => {
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
    const row0Err: RegistrationValidationError = {
      fieldName: "sample_submitter_id",
      index: 0,
      donorSubmitterId: "AB1",
      info: {
        conflictingRows: [2]
      },
      type: DataValidationErrors.NEW_SAMPLE_CONFLICT
    };

    const row2Err: RegistrationValidationError = {
      fieldName: "sample_submitter_id",
      index: 2,
      donorSubmitterId: "AB1",
      info: {
        conflictingRows: [0]
      },
      type: DataValidationErrors.NEW_SAMPLE_CONFLICT
    };

    chai.expect(result.errors.length).to.eq(2);
    chai.expect(result.errors[0]).to.deep.eq(row0Err);
    chai.expect(result.errors[1]).to.deep.eq(row2Err);
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
          gender: "Female",
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
    const row0Err: RegistrationValidationError = {
      fieldName: "sample_type",
      index: 0,
      donorSubmitterId: "AB1",
      info: {
        conflictingRows: [2]
      },
      type: DataValidationErrors.NEW_SAMPLE_CONFLICT
    };

    const row2Err = {
      fieldName: "sample_type",
      index: 2,
      donorSubmitterId: "AB1",
      info: {
        conflictingRows: [0]
      },
      type: DataValidationErrors.NEW_SAMPLE_CONFLICT
    };

    chai.expect(result.errors.length).to.eq(2);
    chai.expect(result.errors[0]).to.deep.eq(row0Err);
    chai.expect(result.errors[1]).to.deep.eq(row2Err);
  });
});
