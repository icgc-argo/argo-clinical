// using import fails when running the test
// import * as chai from "chai";
const chai = require("chai");
const mongoose = require("mongoose");
const { GenericContainer } = require("testcontainers");
// needed for types
import "chai-http";
import "mocha";
import { configManager } from "../../../src/config";

import app from "../../../src/app";
chai.use(require("chai-http"));
chai.should();
let container: any;

describe("Submission", () => {
  // will run when all tests are finished
  before(async (done) => {
    try {
      container = await new GenericContainer("mongo")
        .withExposedPorts(27017)
        .start();
      configManager.setConfigImpl({
        getMongoUrl: () => {
          return "";
        }
      });
    } catch (err) {
      console.error("before >>>>>>>>>>>", err);
    }
    await new Promise(done => setTimeout(done, 5000));
  });

  // will run when all tests are finished
  after(async () => {
    let error;
    try {
      if (container) {
        await container.stop();
      }
    } catch (err) {
      console.error("after >>>>>>>>>>>", err);
      error = err;
    }
    try {
      await mongoose.connection.close();
    } catch (err) {
      console.error("after >>>>>>>>>>>", err);
      error = err;
    }
    return error;
  });

  describe("registration", () => {
    it("should return 404 if no registration found", (done) => {
      chai.request(app)
        .get("/submission/registration?programId=NONE-EX")
        .end((err: any, res: any) => {
          res.should.have.status(404);
          done();
        });
    });
  });
});

