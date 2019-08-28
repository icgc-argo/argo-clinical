import chai from "chai";
// needed for typescript
import "chai-http";
import "mocha";
import { GenericContainer } from "testcontainers";
import app from "../../../src/app";
import * as bootstrap from "../../../src/bootstrap";
import { cleanCollection, insertData, resetCounters } from "../testutils";
import { TEST_PUB_KEY, JWT_CLINICALSVCADMIN } from "../test.jwt";
export let mongoContainer: any;
chai.use(require("chai-http"));
chai.should();
let dburl = ``;

const donorDoc = {
  followUps: [],
  treatments: [],
  chemotherapy: [],
  HormoneTherapy: [],
  donorId: 4001,
  gender: "Male",
  submitterId: "1234abcd",
  programId: "PACA-AU",
  specimens: [
    {
      samples: [
        {
          sampleType: "Amplified DNA",
          submitterId: "sm200-1",
          sampleId: 3002
        }
      ],
      specimenType: "Blood derived",
      tumourNormalDesignation: "Recurrent tumour",
      submitterId: "ss200-1",
      specimenId: 893
    }
  ]
};

describe("clinical Api", () => {
  // will run when all tests are finished
  before(() => {
    return (async () => {
      try {
        mongoContainer = await new GenericContainer("mongo").withExposedPorts(27017).start();
        console.log("mongo test container started");
        await bootstrap.run({
          mongoPassword() {
            return "";
          },
          mongoUser() {
            return "";
          },
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
          },
          schemaServiceUrl() {
            return `file://${__dirname}/stub-schema.json`;
          }
        });
      } catch (err) {
        console.error("before >>>>>>>>>>>", err);
        return err;
      }
    })();
  });

  describe("donor endpoints", function() {
    this.beforeEach(async () => {
      try {
        await cleanCollection(dburl, "donors");
        return;
      } catch (err) {
        console.error(err);
        return err;
      }
    });

    describe("id endpoints", function() {
      it("/clinical/donors/id should return donor id if it exists", async function() {
        await insertData(dburl, "donors", donorDoc);
        chai
          .request(app)
          .get("/clinical/donors/id?programId=PACA-AU&submitterId=1234abcd")
          .auth(JWT_CLINICALSVCADMIN, { type: "bearer" })
          .end((err: any, res: any) => {
            try {
              res.should.have.status(200);
              res.should.have.contentType("text/plain");
              res.text.should.eq("DO4001");
              return;
            } catch (e) {
              return e;
            }
          });
      });

      it("/clinical/samples/id should return sample id if it exists", async function() {
        await insertData(dburl, "donors", donorDoc);
        chai
          .request(app)
          .get("/clinical/samples/id?programId=PACA-AU&submitterId=sm200-1")
          .auth(JWT_CLINICALSVCADMIN, { type: "bearer" })
          .end((err: any, res: any) => {
            try {
              res.should.have.status(200);
              res.should.have.contentType("text/plain");
              res.text.should.eq("SA3002");
              return;
            } catch (e) {
              return e;
            }
          });
      });

      it("/clinical/specimens/id should return donor id if it exists", async function() {
        await insertData(dburl, "donors", donorDoc);
        chai
          .request(app)
          .get("/clinical/specimens/id?programId=PACA-AU&submitterId=ss200-1")
          .auth(JWT_CLINICALSVCADMIN, { type: "bearer" })
          .end((err: any, res: any) => {
            try {
              res.should.have.status(200);
              res.should.have.contentType("text/plain");
              res.text.should.eq("SP893");
              return;
            } catch (e) {
              return e;
            }
          });
      });

      it("/clinical/donors/id should return 404 if no id found", async function() {
        await insertData(dburl, "donors", donorDoc);
        chai
          .request(app)
          .get("/clinical/donors/id?programId=PACA-A&submitterId=1234abcd")
          .auth(JWT_CLINICALSVCADMIN, { type: "bearer" })
          .end((err: any, res: any) => {
            try {
              res.should.have.status(404);
              return;
            } catch (e) {
              return e;
            }
          });
      });

      it("/clinical/samples/id should return sample id if no id found", async function() {
        await insertData(dburl, "donors", donorDoc);
        chai
          .request(app)
          .get("/clinical/samples/id?programId=PACA-AU&submitterId=sm20-1")
          .auth(JWT_CLINICALSVCADMIN, { type: "bearer" })
          .end((err: any, res: any) => {
            try {
              res.should.have.status(404);
              return;
            } catch (e) {
              return e;
            }
          });
      });

      it("/clinical/specimens/id should return donor id if no id found", async function() {
        await insertData(dburl, "donors", donorDoc);
        chai
          .request(app)
          .get("/clinical/specimens/id?programId=PACA-AU&submitterId=ss2001")
          .auth(JWT_CLINICALSVCADMIN, { type: "bearer" })
          .end((err: any, res: any) => {
            try {
              res.should.have.status(404);
              return;
            } catch (e) {
              return e;
            }
          });
      });
    }); // end of id endpoints
  }); // end of donor apis
}); // end of clinical apis
