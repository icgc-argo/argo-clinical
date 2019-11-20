// using import fails when running the test
import chai from 'chai';
// needed for types
import 'chai-http';
import 'mocha';
import mongoose from 'mongoose';
import { GenericContainer } from 'testcontainers';
import _ from 'lodash';
import { promisify } from 'bluebird';
import { SchemasDictionary } from '../../../src/lectern-client/schema-entities';
import { schemaClient } from '../../../src/lectern-client/schema-rest-client';
const ServerMock: any = require('mock-http-server') as any;

chai.use(require('chai-http'));
chai.should();
mongoose.set('debug', true);

describe('Lectern Client', () => {
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
        mongoContainer = await new GenericContainer('mongo').withExposedPorts(27017).start();
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

  describe('rest client', () => {
    it('should fetch schema diff', async function() {
      const diffResponse: any[] = require('./schema-diff.1.json') as SchemasDictionary[];
      server.on({
        method: 'GET',
        path: '/lectern/diff',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: () => {
            console.log('in mock server reply');
            return JSON.stringify(diffResponse);
          },
        },
      });

      const response = await schemaClient.fetchDiff(
        'http://localhost:54321/lectern',
        'abc',
        '1.0',
        '2.0',
      );
      chai.expect(response).to.not.be.undefined;
    });
  });
});
