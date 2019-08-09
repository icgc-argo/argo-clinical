// using import fails when running the test
// import * as chai from "chai";
import chai from "chai";
import mongo from "mongodb";
import fs from "fs";
// needed for types
import "chai-http";
import "mocha";
import { GenericContainer } from "testcontainers";
import app from "../../../src/app";
import * as bootstrap from "../../../src/bootstrap";
import { cleanCollection } from "../testutils";
import { TEST_PUB_KEY, JWT_ABCDEF, JWT_WXYZEF } from "./test.jwt";
import {
  ActiveRegistration,
  CreateRegistrationResult
} from "../../../src/submission/submission-entities";
export let mongoContainer: any;
chai.use(require("chai-http"));
chai.should();
let dburl = ``;

const expectedResponse1 = {
  registration: {
    programId: "ABCD-EF",
    creator: "Test User",
    stats: {
      newDonorIds: {
        abcd123: [0]
      },
      newSpecimenIds: {
        ss123: [0]
      },
      newSampleIds: {
        sm123: [0]
      }
    },
    records: [
      {
        program_id: "ABCD-EF",
        donor_submitter_id: "abcd123",
        gender: "Male",
        specimen_submitter_id: "ss123",
        specimen_type: "FFPE",
        tumour_normal_designation: "Normal",
        sample_submitter_id: "sm123",
        sample_type: "ctDNA"
      }
    ],
    __v: 0
  },
  errors: [],
  successful: true
};

describe("Submission Api", () => {
  // will run when all tests are finished
  before(() => {
    return (async () => {
      try {
        mongoContainer = await new GenericContainer("mongo").withExposedPorts(27017).start();
        console.log("mongo test container started");
        await bootstrap.run({
          mongoUrl: () => {
            dburl = `mongodb://${mongoContainer.getContainerIpAddress()}:${mongoContainer.getMappedPort(
              27017
            )}/clinical`;
            return dburl;
          },
          initialSchemaVersion() {
            return "1.0";
          },
          schemaName() {
            return "ARGO Dictionary";
          },
          jwtPubKey() {
            return TEST_PUB_KEY;
          },
          jwtPubKeyUrl() {
            return "";
          }
        });
      } catch (err) {
        console.error("before >>>>>>>>>>>", err);
        return err;
      }
    })();
  });

  describe("registration", function() {
    this.beforeEach(() => {
      console.log("registration beforeAll called");
      return cleanCollection(dburl, "activeregistrations");
    });

    it("should return 200 and empty json if no registration found", function(done) {
      chai
        .request(app)
        .get("/submission/program/ABCD-EF/registration")
        .auth(JWT_ABCDEF, { type: "bearer" })
        .end((err: any, res: any) => {
          res.should.have.status(200);
          res.body.should.deep.eq({});
          done();
        });
    });

    it("should return 401 for missing token", function(done) {
      chai
        .request(app)
        .get("/submission/program/NONE-EX/registration")
        .end((err: any, res: any) => {
          res.should.have.status(401);
          done();
        });
    });

    it("GET should return 403 for wrong scope", function(done) {
      chai
        .request(app)
        .get("/submission/program/NONE-EX/registration")
        .auth(JWT_ABCDEF, { type: "bearer" })
        .end((err: any, res: any) => {
          res.should.have.status(403);
          done();
        });
    });

    it("should return 403 requested program doesn't match authorized in token scopes", done => {
      let file: Buffer;
      try {
        file = fs.readFileSync(__dirname + "/registration.tsv");
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        .post("/submission/program/ABCD-EF/registration")
        // passing token with different program
        .auth(JWT_WXYZEF, { type: "bearer" })
        .type("form")
        .attach("registrationFile", file, "registration.tsv")
        .end((err: any, res: any) => {
          res.should.have.status(403);
          done();
        });
    });

    it("should accept valid registration tsv", done => {
      let file: Buffer;
      try {
        file = fs.readFileSync(__dirname + "/registration.tsv");
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        .post("/submission/program/ABCD-EF/registration")
        .auth(JWT_ABCDEF, { type: "bearer" })
        .type("form")
        .attach("registrationFile", file, "registration.tsv")
        .end(async (err: any, res: any) => {
          try {
            res.should.have.status(201);
            const conn = await mongo.connect(dburl);
            const savedRegistration: ActiveRegistration | null = await conn
              .db("clinical")
              .collection("activeregistrations")
              .findOne({});
            conn.close();
            if (!savedRegistration) {
              throw new Error("saved registration shouldn't be null");
            }
            chai.expect(savedRegistration.programId).to.eq("ABCD-EF");
            chai.expect(savedRegistration.stats).to.deep.eq(expectedResponse1.registration.stats);
            res.body.errors.length.should.eq(0);
            res.body.registration.creator.should.eq("Test User");
            res.body.registration.records.should.deep.eq(expectedResponse1.registration.records);
            res.body.registration._id.should.be.a("string");
            res.body.registration.programId.should.eq(expectedResponse1.registration.programId);
            res.body.registration.stats.should.deep.eq(expectedResponse1.registration.stats);
          } catch (err) {
            return done(err);
          }
          return done();
        });
    });

    it("should not accept invalid registration tsv", done => {
      let file: Buffer;
      try {
        file = fs.readFileSync(__dirname + "/registration.invalid.tsv");
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        .post("/submission/program/ABCD-EF/registration")
        .type("form")
        .attach("registrationFile", file, "registration.invalid.tsv")
        .auth(JWT_ABCDEF, { type: "bearer" })
        .end(async (err: any, res: any) => {
          try {
            res.should.have.status(422);
            res.body.should.deep.eq({
              errors: [
                {
                  index: 0,
                  type: "MISSING_REQUIRED_FIELD",
                  info: {
                    donorSubmitterId: "abcd123",
                    sampleSubmitterId: "sp123",
                    specimenSubmitterId: "sp123"
                  },
                  fieldName: "tumour_normal_designation"
                },
                {
                  fieldName: "program_id",
                  index: 0,
                  info: {
                    expectedProgram: "ABCD-EF",
                    donorSubmitterId: "abcd123",
                    sampleSubmitterId: "sam123",
                    specimenSubmitterId: "sp123",
                    value: "PEXA-MX"
                  },
                  type: "INVALID_PROGRAM_ID"
                }
              ],
              successful: false
            });
            const conn = await mongo.connect(dburl);
            const count = await conn
              .db("clinical")
              .collection("activeregistrations")
              .count({});
            conn.close();
            chai.expect(count).to.eq(0);
          } catch (err) {
            return done(err);
          }
          return done();
        });
    });
  });
});
