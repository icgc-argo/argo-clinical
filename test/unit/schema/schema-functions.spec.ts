import chai from "chai";
import * as schemaService from "../../../src/lectern-client/schema-functions";
import { DataSchema } from "../../../src/lectern-client/schema-entities";
chai.should();

describe("schema-functions", () => {
  it("should populate records based on default value ", () => {
    const schema: DataSchema = require("./schema.json")[0];
    const result = schemaService.populateDefaults(schema, "registration", [
      {
        program_id: "PEME-CA",
        donor_submitter_id: "donor1234",
        gender: "",
        specimen_submitter_id: "87813",
        specimen_type: "SKIN",
        tumor_normal_designation: "n/a",
        sample_submitter_id: "sam123",
        sample_type: "RNA"
      },
      {
        program_id: "PEME-CA",
        donor_submitter_id: "donor1234",
        specimen_submitter_id: "87813",
        specimen_type: "SKIN",
        tumor_normal_designation: "n/a",
        sample_submitter_id: "sam123",
        sample_type: "RNA"
      }
    ]);
    chai.expect(result[0].gender).to.eq("Other");
    chai.expect(result[1].gender).to.eq("Other");
  });

  it("should execute validation pipelines and return errors", () => {
    const schema: DataSchema = require("./schema.json")[0];
    const result = schemaService.populateDefaults(schema, "registration", [
      {
        program_id: "PEME-CA",
        donor_submitter_id: "donor1234",
        gender: "",
        specimen_submitter_id: "87813",
        specimen_type: "SKIN",
        tumor_normal_designation: "n/a",
        sample_submitter_id: "sam123",
        sample_type: "RNA"
      }
    ]);
    chai.expect(result[0].gender).to.eq("Other");
  });
});
