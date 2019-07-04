// using import fails when running the test
// import * as chai from "chai";
const chai = require("chai");
// needed for types
import "chai-http";
import "mocha";
import app from "../src/app";

chai.use(require("chai-http"));
chai.should();

// describe("GET /random-url", () => {
//   it("should return 404", (done) => {
//     chai.request(app)
//       .get("/reset")
//       .end((err: any, res: any) => {
//         res.should.have.status(404);
//         done();
//       });
//   });
// });

// describe("GET /random-url", () => {
//   it("should return 404", (done) => {
//     chai.request(app)
//       .get("/submission/registration?programId=PECA-CA")
//       .end((err: any, res: any) => {
//         if (err) {
//           console.error(err);
//           done();
//           return;
//         }
//         res.should.have.status(404);
//         done();
//       });
//   });
// });