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
// import * as chai from "chai";
const dotEnvPath = __dirname + '/performance.env';
import path from 'path';
require('dotenv').config({ path: dotEnvPath });
console.log('env cpus: ' + process.env.ALLOWED_CPUS);
import chai from 'chai';
import fs from 'fs';
// needed for types
import 'chai-http';
import 'mocha';
import winston from 'winston';
import mongoose from 'mongoose';
import { GenericContainer, Wait } from 'testcontainers';
import app from '../../src/app';
import * as bootstrap from '../../src/bootstrap';
import { cleanCollection, resetCounters } from '../integration/testutils';
import { TEST_PUB_KEY, JWT_CLINICALSVCADMIN } from '../integration/test.jwt';
import {
	CreateRegistrationResult,
	CreateSubmissionResult,
	ValidateSubmissionResult,
} from '../../src/submission/submission-entities';
import { ClinicalEntitySchemaNames } from '../../src/common-model/entities';

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
		const promises = collections.map((collectionName) => cleanCollection(dburl, collectionName));
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
	let mysqlContainer: any;
	let dburl = ``;
	// will run when all tests are finished
	before(() => {
		return (async () => {
			try {
				const mongoContainerPromise = new GenericContainer('mongo', '4.0')
					.withExposedPorts(27017)
					.start();
				const mysqlContainerPromise = new GenericContainer('mysql', '5.7')
					.withEnv('MYSQL_DATABASE', 'rxnorm')
					.withEnv('MYSQL_USER', 'clinical')
					.withEnv('MYSQL_ROOT_PASSWORD', 'password')
					.withEnv('MYSQL_PASSWORD', 'password')
					.withWaitStrategy(Wait.forLogMessage('ready for connections.'))
					.withExposedPorts(3306)
					.start();
				// start containers in parallel
				const containers = await Promise.all([mongoContainerPromise, mysqlContainerPromise]);
				mongoContainer = containers[0];
				mysqlContainer = containers[1];
				console.log('db test containers started');

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
					kafkaProperties() {
						return {
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
						};
					},
					rxNormDbProperties() {
						return {
							database: 'rxnorm',
							user: 'clinical',
							password: 'password',
							timeout: 5000,
							host: mysqlContainer.getContainerIpAddress(),
							port: mysqlContainer.getMappedPort(3306),
						};
					},
					egoUrl() {
						return '';
					},
					egoClientId() {
						return '';
					},
					egoClientSecret() {
						return '';
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
		mysqlContainer.stop();
	});

	describe('clinical submission', function() {
		const num = 3000;

		this.beforeEach(async () => {
			await clearCollections(dburl, [
				'donors',
				'activeregistrations',
				'activesubmissions',
				'counters',
			]);
		});

		let sampleRegFile: Buffer, donor: Buffer, pd: Buffer, specimen: Buffer;

		try {
			sampleRegFile = fs.readFileSync(
				`${__dirname}/files/${num}/${ClinicalEntitySchemaNames.REGISTRATION}.tsv`,
			);
			donor = fs.readFileSync(`${__dirname}/files/${num}/${ClinicalEntitySchemaNames.DONOR}.tsv`);
			pd = fs.readFileSync(
				`${__dirname}/files/${num}/${ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS}.tsv`,
			);
			specimen = fs.readFileSync(
				`${__dirname}/files/${num}/${ClinicalEntitySchemaNames.SPECIMEN}.tsv`,
			);
			console.log('Loaded data file');
		} catch (err) {
			return err;
		}

		/////////////////////////
		// Use Cases
		////////////////////////
		const register = async () => {
			let registrationId: string | undefined;
			await chai
				.request(app)
				.post('/submission/program/TEST-CA/registration')
				.auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
				.type('form')
				.attach('registrationFile', sampleRegFile, `${ClinicalEntitySchemaNames.REGISTRATION}.tsv`)
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

		const uploadClinical = async () => {
			let version: string | undefined;
			await chai
				.request(app)
				.post('/submission/program/TEST-CA/clinical/upload')
				.auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
				.attach('clinicalFiles', donor, `${ClinicalEntitySchemaNames.DONOR}.tsv`)
				.attach('clinicalFiles', pd, `${ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS}..tsv`)
				.attach('clinicalFiles', specimen, `${ClinicalEntitySchemaNames.SPECIMEN}.tsv`)
				.then((res: any) => {
					version = (res.body as CreateSubmissionResult).submission?.version;
					res.should.have.status(200);
				});
			if (!version) throw new Error('upload clinical failed');
			return version;
		};

		const validateSubmission = async (version: string) => {
			if (!version) throw new Error('cannot validate');
			let newVersion: string | undefined;
			await chai
				.request(app)
				.post(`/submission/program/TEST-CA/clinical/validate/${version}`)
				.auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
				.then((res: any) => {
					newVersion = (res.body as ValidateSubmissionResult).submission?.version;
					res.should.have.status(200);
				});
			if (!newVersion) throw new Error('upload clinical failed');
			return newVersion;
		};

		//////////////////////////
		/// Scenarios
		/////////////////////////
		/**
		 * submit ${num}0 unique new samples, then resubmit them for the same program.
		 * in this scenario we will load all donors from db into memory and index them
		 * this will also cover the cases where we check against existing data.
		 */
		it(`Commit ${num} new samples, then resubmit and commit the same ${num} samples`, async function() {
			L.profile(`register.${num}.new`);
			const regId = await register();
			L.profile(`register.${num}.new`);

			L.profile(`commitRegistration.${num}.new`);
			await commitRegistration(regId);
			L.profile(`commitRegistration.${num}.new`);

			L.profile(`register.${num}.existing`);
			const regId2 = await register();
			L.profile(`register.${num}.existing`);

			L.profile(`commitRegistration.${num}.existing`);
			await commitRegistration(regId2);
			L.profile(`commitRegistration.${num}.existing`);
		});

		it(`Commit ${num} new samples, submit clinical data`, async function() {
			const regId = await register();
			await commitRegistration(regId);

			L.profile(`uploadClinical.${num}.new`);
			const version = await uploadClinical();
			L.profile(`uploadClinical.${num}.new`);

			L.profile('validate submission ');
			const valVersion = await validateSubmission(version);
			L.profile('validate submission ');
		});
	});
});
