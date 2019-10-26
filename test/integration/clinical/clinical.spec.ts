import chai from 'chai';
// needed for typescript
import 'chai-http';
import 'mocha';
import { GenericContainer } from 'testcontainers';
import app from '../../../src/app';
import * as bootstrap from '../../../src/bootstrap';
import { cleanCollection, insertData, assertDbCollectionEmpty } from '../testutils';
import { TEST_PUB_KEY, JWT_CLINICALSVCADMIN, JWT_ABCDEF } from '../test.jwt';
import mongoose from 'mongoose';

chai.use(require('chai-http'));
chai.should();

describe('clinical Api', () => {
  let mongoContainer: any;
  let dburl = ``;
  const donorDoc = {
    followUps: [],
    treatments: [],
    chemotherapy: [],
    HormoneTherapy: [],
    donorId: 4001,
    gender: 'Male',
    submitterId: '1234abcd',
    programId: 'PACA-AU',
    specimens: [
      {
        samples: [
          {
            sampleType: 'Amplified DNA',
            submitterId: 'sm200-1',
            sampleId: 3002,
          },
        ],
        specimenTissueSource: 'Blood derived',
        tumourNormalDesignation: 'Recurrent tumour',
        submitterId: 'ss200-1',
        specimenId: 893,
      },
    ],
  };
  // will run when all tests are finished
  before(() => {
    return (async () => {
      try {
        mongoContainer = await new GenericContainer('mongo').withExposedPorts(27017).start();
        dburl = `mongodb://${mongoContainer.getContainerIpAddress()}:${mongoContainer.getMappedPort(
          27017,
        )}/clinical`;
        console.log(`mongo test container started ${dburl}`);
        await bootstrap.run({
          mongoPassword() {
            return '';
          },
          mongoUser() {
            return '';
          },
          mongoUrl: () => {
            return dburl;
          },
          initialSchemaVersion() {
            return '1.0';
          },
          schemaName() {
            return 'ARGO Clinical Submission';
          },
          jwtPubKey() {
            return TEST_PUB_KEY;
          },
          jwtPubKeyUrl() {
            return '';
          },
          schemaServiceUrl() {
            return `file://${__dirname}/stub-schema.json`;
          },
        });
      } catch (err) {
        console.error('before >>>>>>>>>>>', err);
        return err;
      }
    })();
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoContainer.stop();
    return;
  });

  describe('donor endpoints', function() {
    this.beforeEach(async () => {
      try {
        await cleanCollection(dburl, 'donors');
        return;
      } catch (err) {
        console.error(err);
        return err;
      }
    });

    describe('id endpoints', function() {
      it('/clinical/donors/id should return donor id if it exists', async function() {
        console.log('before /donor/id request');
        await insertData(dburl, 'donors', donorDoc);
        return chai
          .request(app)
          .get('/clinical/donors/id?programId=PACA-AU&submitterId=1234abcd')
          .then((res: any) => {
            console.log('asserting /donor/id response');
            res.should.have.status(200);
            res.type.should.eq('text/plain');
            res.text.should.eq('DO4001');
          });
      });

      it('/clinical/samples/id should return sample id if it exists', async function() {
        await insertData(dburl, 'donors', donorDoc);
        return chai
          .request(app)
          .get('/clinical/samples/id?programId=PACA-AU&submitterId=sm200-1')
          .then((res: any) => {
            res.should.have.status(200);
            res.type.should.eq('text/plain');
            res.text.should.eq('SA3002');
          });
      });

      it('/clinical/specimens/id should return specimen id if it exists', async function() {
        await insertData(dburl, 'donors', donorDoc);
        return chai
          .request(app)
          .get('/clinical/specimens/id?programId=PACA-AU&submitterId=ss200-1')
          .then((res: any) => {
            res.should.have.status(200);
            res.type.should.eq('text/plain');
            res.text.should.eq('SP893');
          });
      });

      it('/clinical/donors/id should return 404 if no id found', async function() {
        await insertData(dburl, 'donors', donorDoc);
        return chai
          .request(app)
          .get('/clinical/donors/id?programId=PACA-A&submitterId=1234abcd')
          .then((res: any) => {
            res.should.have.status(404);
          });
      });

      it('/clinical/samples/id should return sample id if no id found', async function() {
        await insertData(dburl, 'donors', donorDoc);
        return chai
          .request(app)
          .get('/clinical/samples/id?programId=PACA-AU&submitterId=sm20-1')
          .then((res: any) => {
            res.should.have.status(404);
          });
      });

      it('/clinical/specimens/id should return specimen id if no id found', async function() {
        await insertData(dburl, 'donors', donorDoc);
        return chai
          .request(app)
          .get('/clinical/specimens/id?programId=PACA-AU&submitterId=ss2001')
          .then((res: any) => {
            res.should.have.status(404);
          });
      });

      describe('program donors enpoints', function() {
        it('/clinical/donors should allow delete with proper auth', async function() {
          await insertData(dburl, 'donors', donorDoc);
          return chai
            .request(app)
            .delete('/clinical/donors?programId=PACA-AU')
            .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
            .then(async (res: any) => {
              res.should.have.status(200);
              await assertDbCollectionEmpty(dburl, 'donors');
            });
        });
        it('/clinical/donors should not allow delete without proper auth', async function() {
          await insertData(dburl, 'donors', donorDoc);
          return chai
            .request(app)
            .delete('/clinical/donors?programId=PACA-AU')
            .auth(JWT_ABCDEF, { type: 'bearer' })
            .then((res: any) => {
              res.should.have.status(403);
            });
        });
      });
    }); // end of id endpoints
  }); // end of donor apis
}); // end of clinical apis
