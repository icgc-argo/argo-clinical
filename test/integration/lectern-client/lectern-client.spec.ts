/*
 * Copyright (c)  2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

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
