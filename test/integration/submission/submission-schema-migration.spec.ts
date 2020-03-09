// using import fails when running the test
// import * as chai from "chai";
import chai from 'chai';
// needed for types
import 'chai-http';
import 'deep-equal-in-any-order';
import 'mocha';
import mongoose from 'mongoose';
import { GenericContainer } from 'testcontainers';
import app from '../../../src/app';
import * as bootstrap from '../../../src/bootstrap';
import { cleanCollection, resetCounters } from '../testutils';
import { TEST_PUB_KEY, JWT_CLINICALSVCADMIN } from '../test.jwt';
import _ from 'lodash';
import { ClinicalEntitySchemaNames } from '../../../src/submission/submission-entities';
import { DonorFieldsEnum } from '../../../src/submission/submission-entities';
import { SampleRegistrationFieldsEnum } from '../../../src/submission/submission-entities';
chai.use(require('chai-http'));
chai.use(require('deep-equal-in-any-order'));

chai.should();

const clearCollections = async (dburl: string, collections: string[]) => {
  try {
    console.log(`Clearing collections pre-test:`, collections.join(', '));
    const promises = collections.map(collectionName => cleanCollection(dburl, collectionName));
    await Promise.all(promises);
    await resetCounters(dburl);
    return;
  } catch (err) {
    console.error(err);
    return err;
  }
};
const schemaName = 'ARGO Clinical Submission';
const schemaVersion = '1.0';

describe('schema migration api', () => {
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
            return `file://${__dirname}/stub-schema.json`;
          },
          testApisDisabled() {
            return false;
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

  beforeEach(async () => {
    await clearCollections(dburl, ['donors', 'dictionarymigrations']);
    await bootstrap.loadSchema(schemaName, schemaVersion);
  });

  it.only('should check new schema is valid with data validation fields', async () => {
    await migrateSyncTo('3.0');

    const res = await getAllMigrationDocs();

    const [migration] = res.body;
    migration.newSchemaErrors.should.deep.eq({
      [ClinicalEntitySchemaNames.DONOR]: {
        missingFields: [],
        invalidFieldCodeLists: [
          { fieldName: DonorFieldsEnum.vital_status, missingCodeListValues: ['Deceased'] },
        ],
      },
      [ClinicalEntitySchemaNames.REGISTRATION]: {
        missingFields: [SampleRegistrationFieldsEnum.specimen_type],
        invalidFieldCodeLists: [],
      },
    });
  });

  it('should migrate to new schema with changing enums', () => {});

  it('should migrate to new schema when adding new file', () => {});

  it('should migrate to new schema when removing exisitng file', () => {});
});

const migrateSyncTo = async (newSchemaVersion: string) => {
  return chai
    .request(app)
    .patch('/submission/schema/?sync=true')
    .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
    .send({
      version: newSchemaVersion,
    });
};

const getAllMigrationDocs = async () => {
  return await chai
    .request(app)
    .get('/submission/schema/migration')
    .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' });
};
