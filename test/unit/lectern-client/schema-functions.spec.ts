import chai from "chai";
import * as schemaService from "../../../src/lectern-client/schema-functions";
import {
  SchemasDictionary,
  SchemaValidationErrorTypes
} from "../../../src/lectern-client/schema-entities";
chai.should();
const schema: SchemasDictionary = require("./schema.json")[0];

describe("schema-functions", () => {
  it("should populate records based on default value ", () => {
    const result = schemaService.process(schema, "registration", [
      {
        program_id: "PEME-CA",
        donor_submitter_id: "OD1234",
        gender: "",
        specimen_submitter_id: "87813",
        specimen_type: "Skin",
        tumour_normal_designation: "Normal",
        sample_submitter_id: "MAS123",
        sample_type: "ctDNA"
      },
      {
        program_id: "PEME-CA",
        donor_submitter_id: "OD1234",
        gender: "",
        specimen_submitter_id: "87812",
        specimen_type: "Skin",
        tumour_normal_designation: "Normal",
        sample_submitter_id: "MAS1234",
        sample_type: "ctDNA"
      }
    ]);
    chai.expect(result.processedRecords[0].gender).to.eq("Other");
    chai.expect(result.processedRecords[1].gender).to.eq("Other");
  });

  it("should NOT populate missing columns based on default value ", () => {
    const result = schemaService.process(schema, "registration", [
      {
        program_id: "PEME-CA",
        donor_submitter_id: "OD1234",
        gendr: "",
        specimen_submitter_id: "87813",
        specimen_type: "Skin",
        tumour_normal_designation: "Normal",
        sample_submitter_id: "MAS123",
        sample_type: "ctDNA"
      },
      {
        program_id: "PEME-CA",
        donor_submitter_id: "OD1234",
        gender: "",
        specimen_submitter_id: "87812",
        specimen_type: "Skin",
        tumour_normal_designation: "Normal",
        sample_submitter_id: "MAS1234",
        sample_type: "ctDNA"
      }
    ]);
    chai.expect(result.validationErrors).to.deep.include({
      errorType: SchemaValidationErrorTypes.MISSING_REQUIRED_FIELD,
      fieldName: "gender",
      index: 0,
      info: {}
    });
  });

  it("should validate required", () => {
    const result = schemaService.process(schema, "registration", [
      {
        donor_submitter_id: "OD1234",
        gender: "Female",
        specimen_submitter_id: "87813",
        specimen_type: "Skin",
        tumour_normal_designation: "Normal",
        sample_submitter_id: "MAS123",
        sample_type: "ctDNA"
      }
    ]);
    chai.expect(result.validationErrors).to.deep.include({
      errorType: SchemaValidationErrorTypes.MISSING_REQUIRED_FIELD,
      fieldName: "program_id",
      index: 0,
      info: {}
    });
  });

  it("should validate value types", () => {
    const result = schemaService.process(schema, "address", [
      {
        country: "US",
        unit_number: "abc",
        postal_code: "12345"
      }
    ]);
    chai.expect(result.validationErrors).to.deep.include({
      errorType: SchemaValidationErrorTypes.INVALID_FIELD_VALUE_TYPE,
      fieldName: "unit_number",
      index: 0,
      info: {}
    });
  });

  it("should validate regex", () => {
    const result = schemaService.process(schema, "registration", [
      {
        program_id: "PEME-CAA",
        donor_submitter_id: "OD1234",
        gender: "Female",
        specimen_submitter_id: "87813",
        specimen_type: "Skin",
        tumour_normal_designation: "Normal",
        sample_submitter_id: "MAS123",
        sample_type: "ctDNA"
      }
    ]);
    chai.expect(result.validationErrors).to.deep.include({
      errorType: SchemaValidationErrorTypes.INVALID_BY_REGEX,
      fieldName: "program_id",
      index: 0,
      info: {}
    });
  });

  it("should validate script", () => {
    const result = schemaService.process(schema, "address", [
      {
        country: "US",
        postal_code: "12"
      },
      {
        country: "CANADA",
        postal_code: "ABC"
      },
      {
        country: "US",
        postal_code: "15523"
      }
    ]);
    chai.expect(result.validationErrors.length).to.eq(2);
    chai.expect(result.validationErrors).to.deep.include({
      errorType: SchemaValidationErrorTypes.INVALID_BY_SCRIPT,
      fieldName: "postal_code",
      index: 0,
      info: { message: "invalid postal code for US" }
    });
    chai.expect(result.validationErrors).to.deep.include({
      errorType: SchemaValidationErrorTypes.INVALID_BY_SCRIPT,
      fieldName: "postal_code",
      index: 1,
      info: { message: "invalid postal code for CANADA" }
    });
  });
});
