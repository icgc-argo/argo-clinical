// using import fails when running the test
// import * as chai from "chai";
import path from 'path';
const dotEnvPath = __dirname + '/performance.env';
require('dotenv').config({ path: dotEnvPath });
console.log('env cpus: ' + process.env.ALLOWED_CPUS);
import chai from 'chai';
import fs from 'fs';
// needed for types
import 'chai-http';
import 'deep-equal-in-any-order';
import 'mocha';
import mongoose from 'mongoose';
import { GenericContainer } from 'testcontainers';
import app from '../../src/app';
import * as bootstrap from '../../src/bootstrap';
import { cleanCollection, resetCounters } from '../integration/testutils';
import { TEST_PUB_KEY, JWT_ABCDEF } from '../integration/test.jwt';
import {
  ClinicalEntitySchemaNames,
  CreateRegistrationResult,
} from '../../src/submission/submission-entities';
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
            return `file:///home/ballabadi/dev/repos/argo/argo-clinical/sampleFiles/sample-schema.json`;
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
        console.error('before >>>>>>>>>>>', err);
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
        .post('/submission/program/ABCD-EF/registration')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .type('form')
        .attach('registrationFile', file, `${ClinicalEntitySchemaNames.REGISTRATION}.3k.tsv`)
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
        .post(`/submission/program/ABCD-EF/registration/${regId}/commit`)
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .then((res: any) => {
          res.should.have.status(200);
        });
    };
    ////////////////////////////

    //////////////////////////
    /// Scenarios
    /////////////////////////
    /**
     * submit 3000 unique & new samples to an empty program (all cache hits will be miss)
     */
    it('Submit 3000 NEW samples into empty db & program', async function() {
      await timeit(register3k);
    });

    /**
     * Times committing 3000 donors registration into empty program
     */
    it('Commit 3000 donors Registration into empty db', async function() {
      const regId = await register3k();
      await timeit(async () => await commitRegistration(regId));
    });

    /**
     * submit 3000 unique samples that already exist for the same program.
     * in this scenario we will load all donors from db into memory and index them
     * this will also cover the cases where we check against existing data.
     */
    it('Submit 3000 existing samples', async function() {
      const regId = await register3k();
      await commitRegistration(regId);
      await timeit(register3k);
    });
  });
});

const timeit = async (fn: Function) => {
  const start = new Date().getTime();
  await fn();
  const diff = (new Date().getTime() - start) / 1000.0;
  console.log(diff);
};
