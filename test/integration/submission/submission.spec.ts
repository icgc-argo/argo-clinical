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
export let mongoContainer: any;
chai.use(require("chai-http"));
chai.should();

let dburl = ``;
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
    it("should return 404 if no registration found", function(done) {
      chai
        .request(app)
        .get("/submission/registration?programId=NONE-EX")
        .end((err: any, res: any) => {
          res.should.have.status(404);
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
        .post("/submission/registration")
        .type("form")
        .attach("registrationFile", file, "registration.tsv")
        .field("creator", "testor")
        .field("programId", "PEXA-MX")
        .end(async (err: any, res: any) => {
          res.should.have.status(201);
          try {
            const conn = await mongo.connect(dburl);
            const reg = await conn
              .db("clinical")
              .collection("activeregistrations")
              .findOne({});
            conn.close();
            chai.expect(reg.programId).to.eq("PEXA-MX");
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
        .post("/submission/registration")
        .type("form")
        .attach("registrationFile", file, "registration.invalid.tsv")
        .field("creator", "testor")
        .field("programId", "PEXA-MX")
        .end(async (err: any, res: any) => {
          res.should.have.status(422);
          try {
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
