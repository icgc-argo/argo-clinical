// using import fails when running the test
import chai from 'chai';
// needed for types
import 'chai-http';
import 'mocha';
import mongoose from 'mongoose';
import { GenericContainer } from 'testcontainers';
import { cleanCollection, findInDb } from '../testutils';
import _ from 'lodash';
import * as manager from '../../../src/schema/schema-manager';
import { promisify } from 'bluebird';
import { SchemasDictionary } from '../../../src/lectern-client/schema-entities';
const ServerMock: any = require('mock-http-server') as any;

chai.use(require('chai-http'));
chai.should();

describe('manager', () => {
  let mongoContainer: any;
  let dburl = ``;
  const schemaName = 'ARGO Clinical Submission';
  const server = new ServerMock({ host: 'localhost', port: 54321 });
  const startServerPromise = promisify(server.start);

  // we don't do a full bootstrap here like other integration tests, this test is meant to be
  // lectern client specific and agnostic of clinical so it can be isolated without dependencies on argo
  const prep = async (mongoUrl: string) => {
    await mongoose.connect(mongoUrl, {
      // https://mongoosejs.com/docs/deprecations.html
      useNewUrlParser: true,
      useFindAndModify: false,
    });
  };

  // will run when all tests are finished
  before(() => {
    return (async () => {
      try {
        mongoContainer = await new GenericContainer('mongo', '4.0').withExposedPorts(27017).start();
        console.log('mongo test container started');
        dburl = `mongodb://${mongoContainer.getContainerIpAddress()}:${mongoContainer.getMappedPort(
          27017,
        )}/clinical`;
        await prep(dburl);
        await startServerPromise();
      } catch (err) {
        console.error('Lectern Client : before >>>>>>>>>>>', err);
        return err;
      }
    })();
  });

  after(async () => {
    await mongoose.disconnect();
    await promisify(server.stop)();
    await mongoContainer.stop();
  });

  beforeEach(async () => await cleanCollection(dburl, 'dataschemas'));

  it('should load schema in db', async function() {
    // has to be done in every test to reset the state of the manager
    manager.create('http://localhost:54321/lectern');
    const dictionaries: SchemasDictionary[] = require('./dictionary.response.1.json') as SchemasDictionary[];
    server.on({
      method: 'GET',
      path: '/lectern/dictionaries',
      reply: {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: () => {
          console.log('in mock server reply');
          return JSON.stringify(dictionaries);
        },
      },
    });

    let result: SchemasDictionary | undefined = undefined;
    try {
      result = await manager.instance().loadSchemaAndSave(schemaName, '1.0');
    } catch (er) {
      return er;
    }
    const dbSchema = (await findInDb(dburl, 'dataschemas', {})) as any[];
    chai.expect(dbSchema).to.not.be.undefined;
    chai.expect(dbSchema.length).to.eq(1);
    chai.expect(dbSchema[0].name).to.eq(schemaName);
    chai.expect(dbSchema[0].version).to.eq('1.0');
    chai.expect(dbSchema[0].schemas.length).to.eq(9);
    chai.expect(result).to.not.be.undefined;
    // had to convert the id to string from bsonArray before comparison
    dbSchema[0]._id = dbSchema[0]._id.toString();
    chai.expect(result).to.deep.eq(dbSchema[0]);
  });

  it('should update schema version', async function() {
    // has to be done in every test to reset the state of the manager
    manager.create('http://localhost:54321/lectern');
    const dictionaryV1: SchemasDictionary[] = require('./dictionary.response.1.json') as SchemasDictionary[];
    const dictionaryV2: SchemasDictionary[] = require('./dictionary.response.2.json') as SchemasDictionary[];
    server.on({
      method: 'GET',
      path: '/lectern/dictionaries',
      reply: {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: (req: any) => {
          console.log('in mock server reply');
          if (req.query['version'] == '2.0') {
            return JSON.stringify(dictionaryV2);
          }
          return JSON.stringify(dictionaryV1);
        },
      },
    });
    let resultV1: SchemasDictionary | undefined = undefined;
    let resultV2: SchemasDictionary | undefined = undefined;
    try {
      resultV1 = await manager.instance().loadSchemaAndSave(schemaName, '1.0');
    } catch (er) {
      return er;
    }
    chai.expect(resultV1).to.not.be.undefined;
    try {
      resultV2 = await manager.instance().loadAndSaveNewVersion(schemaName, '2.0');
    } catch (er) {
      return er;
    }

    const dbSchema = (await findInDb(dburl, 'dataschemas', {})) as any[];
    chai.expect(dbSchema).to.not.be.undefined;
    chai.expect(dbSchema.length).to.eq(1);
    chai.expect(dbSchema[0].name).to.eq(schemaName);
    chai.expect(dbSchema[0].version).to.eq('2.0');
    chai.expect(dbSchema[0].schemas.length).to.eq(9);
    // had to convert the id to string from bsonArray before comparison
    dbSchema[0]._id = dbSchema[0]._id.toString();
    chai.expect(resultV2).to.deep.eq(dbSchema[0]);
  });

  describe('migration apis', () => {
    describe('probe changes api', () => {});
  });
});
