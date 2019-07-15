// using import fails when running the test
// import * as chai from "chai";
const chai = require("chai");
const mongoose = require("mongoose");
import fs from "fs";
// needed for types
import "chai-http";
import "mocha";
import { GenericContainer } from "testcontainers";
import app from "../../../src/app";
import * as bootstrap from "../../../src/bootstrap";
export let mongoContainer: any;
chai.use(require("chai-http"));
chai.should();

describe("Submission Api", async function() {
  // will run when all tests are finished
  before(async function() {
    try {
      mongoContainer = await new GenericContainer("mongo")
        .withExposedPorts(27017)
        .start();
      await bootstrap.run({
        mongoUrl: () => {
            return `mongodb://${mongoContainer.getContainerIpAddress()}:${mongoContainer.getMappedPort(27017)}/clinical`;
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
    }
  });

  describe("registration", function() {
    it("should return 404 if no registration found", function(done) {
      chai.request(app)
        .get("/submission/registration?programId=NONE-EX")
        .end((err: any, res: any) => {
          res.should.have.status(404);
          done();
        });
    });

    it("should upload registration tsv", function(done) {
      let file: Buffer;
      try {
        file = fs.readFileSync(__dirname + "/registration.tsv");
      } catch (err) {
        done(err);
      }
      chai.request(app)
        .post("/submission/registration")
        .type("form")
        .attach("registrationFile", file, "registration.tsv")
        .field("creator", "testor")
        .field("programId", "PEXA-MX")
        .end((err: any, res: any) => {
          res.should.have.status(201);
          done();
        });
    });
  });
});



