// using import fails when running the test
import chai from 'chai';
// needed for types
import 'chai-http';
import 'mocha';
import mongoose from 'mongoose';
import _ from 'lodash';
import { promisify } from 'bluebird';
import { SchemasDictionary } from '../../../src/lectern-client/schema-entities';
import { schemaClient } from '../../../src/lectern-client/schema-rest-client';
const ServerMock: any = require('mock-http-server') as any;

chai.use(require('chai-http'));
chai.should();

describe('Lectern Client', () => {
  const server = new ServerMock({ host: 'localhost', port: 54321 });
  const startServerPromise = promisify(server.start);

  // will run when all tests are finished
  before(() => {
    return (async () => {
      try {
        await startServerPromise();
      } catch (err) {
        console.error('Lectern Client : before >>>>>>>>>>>', err);
        return err;
      }
    })();
  });

  after(async () => {
    await promisify(server.stop)();
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
