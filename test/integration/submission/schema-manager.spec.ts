/*
 * Copyright (c) 2023 The Ontario Institute for Cancer Research. All rights reserved
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
import { entities as dictionaryEntities } from '@overturebio-stack/lectern-client';
import { promisify } from 'bluebird';
import 'chai-http';
import _ from 'lodash';
import 'mocha';
import mongoose from 'mongoose';
import { GenericContainer } from 'testcontainers';
import * as manager from '../../../src/dictionary/manager';
import { cleanCollection, findInDb, updateData } from '../testutils';
const ServerMock: any = require('mock-http-server') as any;

chai.use(require('chai-http'));
chai.should();

describe('manager', () => {
	let mongoContainer: any;
	let dbUrl = ``;
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
				mongoContainer = await new GenericContainer('mongo:4.0').withExposedPorts(27017).start();
				console.log('mongo test container started');
				dbUrl = `mongodb://${mongoContainer.getContainerIpAddress()}:${mongoContainer.getMappedPort(
					27017,
				)}/clinical`;
				await prep(dbUrl);
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

	beforeEach(async () => await cleanCollection(dbUrl, 'dataschemas'));

	it('should load schema in db', async function() {
		// has to be done in every test to reset the state of the manager
		manager.create('http://localhost:54321/lectern');
		const dictionaries: dictionaryEntities.SchemasDictionary[] = require('./dictionary.response.1.json') as dictionaryEntities.SchemasDictionary[];
		server.on({
			method: 'GET',
			path: '/lectern/dictionaries',
			reply: {
				status: 200,
				headers: { 'content-type': 'application/json' },
				body: () => {
					return JSON.stringify(dictionaries);
				},
			},
		});

		let result: dictionaryEntities.SchemasDictionary | undefined = undefined;
		try {
			result = await manager.instance().loadSchemaAndSave(schemaName, '1.0');
		} catch (er) {
			return er;
		}
		const dbSchema = (await findInDb(dbUrl, 'dataschemas', {})) as any[];
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
		const dictionaryV1: dictionaryEntities.SchemasDictionary[] = require('./dictionary.response.1.json') as dictionaryEntities.SchemasDictionary[];
		const dictionaryV2: dictionaryEntities.SchemasDictionary[] = require('./dictionary.response.2.json') as dictionaryEntities.SchemasDictionary[];
		server.on({
			method: 'GET',
			path: '/lectern/dictionaries',
			reply: {
				status: 200,
				headers: { 'content-type': 'application/json' },
				body: (req: any) => {
					if (req.query['version'] == '2.0') {
						return JSON.stringify(dictionaryV2);
					}
					return JSON.stringify(dictionaryV1);
				},
			},
		});
		let resultV1: dictionaryEntities.SchemasDictionary | undefined = undefined;
		let resultV2: dictionaryEntities.SchemasDictionary | undefined = undefined;
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

		const dbSchema = (await findInDb(dbUrl, 'dataschemas', {})) as any[];
		chai.expect(dbSchema).to.not.be.undefined;
		// Manager now adds the latest Dictionary, rather than replacing
		chai.expect(dbSchema.length).to.eq(2);
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
