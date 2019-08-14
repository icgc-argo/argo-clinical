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
import { cleanCollection, insertData } from "../testutils";
import { TEST_PUB_KEY, JWT_ABCDEF, JWT_WXYZEF } from "./test.jwt";
import {
  ActiveRegistration,
  CreateRegistrationResult
} from "../../../src/submission/submission-entities";
export let mongoContainer: any;
chai.use(require("chai-http"));
chai.should();
let dburl = ``;

const expectedErrors = [
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
    fieldName: "submitter_specimen_id",
    index: 0,
    info: {
      donorSubmitterId: "abcd123",
      sampleSubmitterId: "sp123",
      specimenSubmitterId: "sp123",
      value: "sp123"
    },
    type: "INVALID_BY_REGEX"
  },
  {
    fieldName: "sample_submitter_id",
    index: 0,
    info: {
      donorSubmitterId: "abcd123",
      sampleSubmitterId: "sp123",
      specimenSubmitterId: "sp123",
      value: "sam123"
    },
    type: "INVALID_BY_REGEX"
  },
  {
    fieldName: "gender",
    index: 0,
    info: {
      donorSubmitterId: "abcd123",
      sampleSubmitterId: "sp123",
      specimenSubmitterId: "sp123",
      value: "male"
    },
    type: "INVALID_ENUM_VALUE"
  },
  {
    fieldName: "sample_type",
    index: 0,
    info: {
      donorSubmitterId: "abcd123",
      sampleSubmitterId: "sp123",
      specimenSubmitterId: "sp123",
      value: "RNA"
    },
    type: "INVALID_ENUM_VALUE"
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
];

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
        submitter_specimen_id: "ss123",
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
const ABCD_REGISTRATION_DOC: ActiveRegistration = {
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
    },
    alreadyRegistered: {}
  },
  records: [
    {
      program_id: "ABCD-EF",
      donor_submitter_id: "abcd123",
      gender: "Male",
      submitter_specimen_id: "ss123",
      specimen_type: "FFPE",
      tumour_normal_designation: "Normal",
      sample_submitter_id: "sm123",
      sample_type: "ctDNA"
    }
  ]
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
    this.beforeEach(async () => {
      try {
        console.log("registration beforeAll called");
        await cleanCollection(dburl, "donors");
        return await cleanCollection(dburl, "activeregistrations");
      } catch (err) {
        return err;
      }
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

    it("should commit registration", done => {
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
            await assertUploadOK(res);
            const regId = res.body.registration._id;
            chai
              .request(app)
              .post(`/submission/program/ABCD-EF/registration/${regId}/commit`)
              .auth(JWT_ABCDEF, { type: "bearer" })
              .end(async (err: any, res: any) => {
                try {
                  await asserCommitOK(res);
                } catch (err) {
                  return done(err);
                }
                return done();
              });
          } catch (err) {
            return done(err);
          }
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
              errors: expectedErrors,
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
    it("Registration should return 404 if try to delete non exsistent registration", done => {
      chai
        .request(app)
        // data base is empty so ID shouldn't exist
        .delete("/submission/program/ABCD-EF/registration/5d51800c9014b11151d419cf")
        .auth(JWT_ABCDEF, { type: "bearer" })
        .end((err: any, res: any) => {
          res.should.have.status(404);
          done();
        });
    });
    it("Registration should return 200 if deleted existing registration", async () => {
      console.log("Runing deleteion test here ");
      const registrationId = await insertData(dburl, "activeregistrations", ABCD_REGISTRATION_DOC);
      console.log("Deleting registration " + registrationId);
      chai
        .request(app)
        .delete("/submission/program/ABCD-EF/registration/" + registrationId)
        .auth(JWT_ABCDEF, { type: "bearer" })
        .end(async (err: any, res: any) => {
          try {
            res.should.have.status(200);
            const conn = await mongo.connect(dburl);
            const count = await conn
              .db("clinical")
              .collection("activeregistrations")
              .count({});
            conn.close();
            chai.expect(count).to.eq(0);
          } catch (err) {
            return err;
          }
        });
    });
  });
});

async function asserCommitOK(res: any) {
  res.should.have.status(200);
  const conn = await mongo.connect(dburl);
  const donor: ActiveRegistration | null = await conn
    .db("clinical")
    .collection("donors")
    .findOne({});
  conn.close();
  if (!donor) {
    throw new Error("saved registration shouldn't be null");
  }
}

async function assertUploadOK(res: any) {
  res.should.have.status(201);
  const conn = await mongo.connect(dburl);
  const savedRegistration: ActiveRegistration | null = await conn
    .db("clinical")
    .collection("activeregistrations")
    .findOne({});
  conn.close();
  console.log(" registration in db ", savedRegistration);
  if (!savedRegistration) {
    throw new Error("saved registration shouldn't be null");
  }
}
