import chai from "chai";
import sinon from "sinon";
import { donorDao } from "../../../src/clinical/donor-repo";
const donorDaoStub = sinon.stub(donorDao, "countBy");
donorDaoStub.returns(Promise.resolve(0));
import * as dv from "../../../src/submission/validation";
import {
  DataValidationError,
  DataValidationErrors,
  CreateRegistrationRecord
} from "../../../src/submission/submission-entities";
import { Donor } from "../../../src/clinical/clinical-entities";
import { stubs } from "./stubs";

const genderMutatedErr: DataValidationError = {
  fieldName: "gender",
  index: 0,
  info: {},
  type: DataValidationErrors.MUTATING_EXISTING_DATA
};
const programInvalidErr: DataValidationError = {
  fieldName: "program_id",
  index: 0,
  info: { expectedProgram: "PEME-CA" },
  type: DataValidationErrors.INVALID_PROGRAM_ID
};
const specimenMutatedErr: DataValidationError = {
  fieldName: "specimen_type",
  index: 0,
  info: {},
  type: DataValidationErrors.MUTATING_EXISTING_DATA
};
const tndError: DataValidationError = {
  fieldName: "tumour_normal_designation",
  index: 0,
  info: {},
  type: DataValidationErrors.MUTATING_EXISTING_DATA
};

const sampleTypeMutatedError: DataValidationError = {
  fieldName: "sample_type",
  index: 0,
  info: {},
  type: DataValidationErrors.MUTATING_EXISTING_DATA
};

describe("data-validator", () => {
  it("should detect invalid program id", async () => {
    // test call
    const result = await dv.validateRegistrationData(
      "PEME-CA",
      [
        {
          donorSubmitterId: "AB1",
          gender: "Male",
          programId: "PEM-CA",
          sampleSubmitterId: "AM1",
          specimenType: "XYZ",
          sampleType: "ST1",
          specimenSubmitterId: "SP1",
          tumourNormalDesignation: "Normal"
        }
      ],
      {}
    );

    // assertions
    chai.expect(result.errors.length).to.eq(1);
    chai.expect(result.errors[0]).to.deep.eq(programInvalidErr);
  });

  it("should detect gender update", async () => {
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
    chai.expect(result.errors.length).to.eq(5);
    chai.expect(result.errors).to.deep.include(sampleTypeMutatedError);
    chai.expect(result.errors).to.deep.include(specimenMutatedErr);
    chai.expect(result.errors).to.deep.include(genderMutatedErr);
    chai.expect(result.errors).to.deep.include(programInvalidErr);
    chai.expect(result.errors).to.deep.include(tndError);
  });
});
