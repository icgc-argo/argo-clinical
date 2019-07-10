// using import fails when running the test
// import * as chai from "chai";
const chai = require("chai");
const mongoose = require("mongoose");
import { GenericContainer } from "testcontainers";
import fs from "fs";
// needed for types
import "chai-http";
import "mocha";
import app from "../../../src/app";
import * as bootstrap from "../../../src/bootstrap";

chai.use(require("chai-http"));
chai.should();
let container: any;

describe("Submission", async function() {
  // will run when all tests are finished
  before(async function() {
    try {
      container = await new GenericContainer("mongo")
        .withExposedPorts(27017)
        .start();
      bootstrap.run({
        getMongoUrl: () => {
          return `mongodb://${container.getContainerIpAddress()}:${container.getMappedPort(27017)}/clinical`;
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
        file = fs.readFileSync("./test/infra/controllers/registration.tsv");
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

  // will run when all tests are finished
  after(async function() {
    let error;
    try {
      console.log("in after");
      if (container) {
        await container.stop();
      }
    } catch (err) {
      console.error("after >>>>>>>>>>>", err);
      error = err;
    }
    console.log("container stoped");
    try {
      await mongoose.connection.close();
    } catch (err) {
      console.error("after >>>>>>>>>>>", err);
      error = err;
    }
    console.log("conn stopped");
    return error;
  });

});



