// using import fails when running the test
// import * as chai from "chai";
const dotEnvPath = __dirname + '/performance.env';
import path from 'path';
require('dotenv').config({ path: dotEnvPath });
console.log('env cpus: ' + process.env.ALLOWED_CPUS);
import chai from 'chai';
import fs from 'fs';
// needed for types
import 'chai-http';
import 'deep-equal-in-any-order';
import 'mocha';
import winston from 'winston';
import mongoose from 'mongoose';
import { GenericContainer } from 'testcontainers';
import app from '../../src/app';
import * as bootstrap from '../../src/bootstrap';
import { cleanCollection, resetCounters } from '../integration/testutils';
import { TEST_PUB_KEY, JWT_CLINICALSVCADMIN } from '../integration/test.jwt';
import {
  ClinicalEntitySchemaNames,
  CreateRegistrationResult,
} from '../../src/submission/submission-entities';

// create a different logger to avoid noise from application
const L = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
});

chai.use(require('chai-http'));
chai.use(require('deep-equal-in-any-order'));
chai.should();

const clearCollections = async (dburl: string, collections: string[]) => {
  try {
    const promises = collections.map(collectionName => cleanCollection(dburl, collectionName));
    await Promise.all(promises);
    await resetCounters(dburl);
    return;
  } catch (err) {
    console.error(err);
    return err;
  }
};
const schemaName = 'ICGC-ARGO Data Dictionary';
const schemaVersion = '1.0';

describe('Submission Api', () => {
  let mongoContainer: any;
  let dburl = ``;
  // will run when all tests are finished
  before(() => {
    return (async () => {
      try {
        mongoContainer = await new GenericContainer('mongo').withExposedPorts(27017).start();
        console.log('mongo test container started');
        await bootstrap.run({
          mongoPassword() {
            return '';
          },
          mongoUser() {
            return '';
          },
          mongoUrl: () => {
            dburl = `mongodb://${mongoContainer.getContainerIpAddress()}:${mongoContainer.getMappedPort(
              27017,
            )}/clinical`;
            return dburl;
          },
          initialSchemaVersion() {
            return schemaVersion;
          },
          schemaName() {
            return schemaName;
          },
          jwtPubKey() {
            return TEST_PUB_KEY;
          },
          jwtPubKeyUrl() {
            return '';
          },
          schemaServiceUrl() {
            return 'file://' + path.resolve(__dirname + `/../../sampleFiles/sample-schema.json`);
          },
          testApisDisabled() {
            return false;
          },
          kafkaMessagingEnabled() {
            return false;
          },
          kafkaBrokers() {
            return new Array<string>();
          },
          kafkaClientId() {
            return '';
          },
          kafkaTopicProgramUpdate() {
            return '';
          },
          kafkaTopicProgramUpdateConfigPartitions(): number {
            return NaN;
          },
          kafkaTopicProgramUpdateConfigReplications(): number {
            return NaN;
          },
        });
      } catch (err) {
        return err;
      }
    })();
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoContainer.stop();
  });

  describe('sample registration', function() {
    this.beforeEach(async () => {
      await clearCollections(dburl, ['donors', 'activeregistrations', 'counters']);
    });

    let file: Buffer;
    try {
      file = fs.readFileSync(`${__dirname}/${ClinicalEntitySchemaNames.REGISTRATION}.3k.tsv`);
      console.log('Loaded data file');
    } catch (err) {
      return err;
    }

    /////////////////////////
    // Use Cases
    ////////////////////////
    const register3k = async () => {
      let registrationId: string | undefined;
      await chai
        .request(app)
        .post('/submission/program/TEST-CA/registration')
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .type('form')
        .attach('registrationFile', file, `${ClinicalEntitySchemaNames.REGISTRATION}.300.tsv`)
        .then((res: any) => {
          registrationId = (res.body as CreateRegistrationResult).registration?._id;
          res.should.have.status(201);
        });
      if (!registrationId) throw new Error('registration failed');
      return registrationId;
    };

    const commitRegistration = async (regId: string) => {
      await chai
        .request(app)
        .post(`/submission/program/TEST-CA/registration/${regId}/commit`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then((res: any) => {
          res.should.have.status(200);
        });
    };
    ////////////////////////////

    //////////////////////////
    /// Scenarios
    /////////////////////////
    /**
     * submit 3000 unique new samples, then resubmit them for the same program.
     * in this scenario we will load all donors from db into memory and index them
     * this will also cover the cases where we check against existing data.
     */
    it('Commit 3000 new samples, then resubmit and commit the same 3k samples', async function() {
      L.profile('register.3k.new');
      const regId = await register3k();
      L.profile('register.3k.new');

      L.profile('commitRegistration.3k.new');
      await commitRegistration(regId);
      L.profile('commitRegistration.3k.new');

      L.profile('register.3k.existing');
      const regId2 = await register3k();
      L.profile('register.3k.existing');

      L.profile('commitRegistration.3k.existing');
      await commitRegistration(regId2);
      L.profile('commitRegistration.3k.existing');
    });
  });
});
