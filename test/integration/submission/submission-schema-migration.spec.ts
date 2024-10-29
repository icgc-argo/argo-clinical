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

import { entities as dictionaryEntities } from '@overturebio-stack/lectern-client';
import app from '../../../src/app';
import * as bootstrap from '../../../src/bootstrap';
import { Donor } from '../../../src/clinical/clinical-entities';
import {
	ClinicalEntitySchemaNames,
	DonorFieldsEnum,
	PrimaryDiagnosisFieldsEnum,
	SpecimenFieldsEnum,
} from '../../../src/common-model/entities';
import {
	DictionaryMigration,
	MigrationStage,
} from '../../../src/submission/migration/migration-entities';
import { SampleRegistrationFieldsEnum } from '../../../src/submission/submission-entities';
import {
	ClinicalProgramUpdateMessage,
	getInstance,
} from '../../../src/submission/submission-updates-messenger';

import chai from 'chai';
import 'chai-http';
import 'deep-equal-in-any-order';
import _ from 'lodash';
import 'mocha';
import mongoose from 'mongoose';
import { SinonSpy, spy } from 'sinon';
import { GenericContainer } from 'testcontainers';
import { JWT_CLINICALSVCADMIN, TEST_PUB_KEY } from '../test.jwt';
import { clearCollections, emptyDonorDocument, findInDb, insertData } from '../testutils';

chai.use(require('chai-http'));
chai.use(require('deep-equal-in-any-order'));
chai.should();

// legacy field name
const PRESENTING_SYMPTOMS = 'presenting_symptoms';
const schemaName = 'ARGO Clinical Submission';
const startingSchemaVersion = '1.0';

describe('schema migration api', () => {
	let sendProgramUpdatedMessageFunc: SinonSpy<[ClinicalProgramUpdateMessage], Promise<void>>;
	let mongoContainer: any;
	let mysqlContainer: any;
	let dbUrl = ``;

	const programId = 'ABCD-EF';
	const donor: Donor = emptyDonorDocument({
		submitterId: 'ICGC_0001',
		programId,
		clinicalInfo: {
			program_id: 'ABCD-EF',
			primary_site: 'Gum',
			vital_status: 'Deceased',
			cause_of_death: 'Unknown',
			submitter_donor_id: 'ICGC_0001',
			survival_time: 120,
		},
	});

	const donor2: Donor = emptyDonorDocument({
		submitterId: 'ICGC_0003',
		programId,
		clinicalInfo: {
			program_id: 'ABCD-EF',
			vital_status: 'Deceased',
			primary_site: 'Gum',
			cause_of_death: 'Died of cancer',
			submitter_donor_id: 'ICGC_0003',
			survival_time: 67,
		},
		specimens: [
			{
				samples: [{ sampleType: 'Total RNA', submitterId: 'sm123-2', sampleId: 610001 }],
				clinicalInfo: {},
				specimenTissueSource: 'Saliva',
				tumourNormalDesignation: 'Tumour',
				specimenType: 'Primary tumour',
				submitterId: 'sub-sp-pacaau-124',
				specimenId: 210001,
				[SpecimenFieldsEnum.percent_tumour_cells_measurement_method]: 'Genomics',
			},
		],
		primaryDiagnoses: [
			{
				primaryDiagnosisId: 1,
				clinicalInfo: {
					submitter_primary_diagnosis_id: 'P1',

					program_id: 'PACA-AU',
					submitter_donor_id: 'ICGC_0003',
					number_lymph_nodes_positive: 1,
					number_lymph_nodes_examined: 2,
					age_at_diagnosis: 96,
					cancer_type_code: 'C41.1',
					clinical_tumour_staging_system: 'Binet staging system',
					clinical_stage_group: 'Stage A',
					presenting_symptoms: ['Nausea', 'Back Pain'],
				},
			},
		],
	});

	const newSchemaInvalidDonor: Donor = emptyDonorDocument({
		submitterId: 'ICGC_0002',
		programId,
		clinicalInfo: {
			program_id: 'ABCD-EF',
			vital_status: 'Unknown',
			primary_site: 'Gum',
			cause_of_death: 'Died of cancer',
			submitter_donor_id: 'ICGC_0002',
			survival_time: 67,
		},
	});

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
					.withExposedPorts(3306)
					.start();
				mongoContainer = await mongoContainerPromise;
				mysqlContainer = await mysqlContainerPromise;
				console.log('db test containers started');
				await bootstrap.run({
					mongoPassword() {
						return '';
					},
					mongoUser() {
						return '';
					},
					mongoUrl: () => {
						dbUrl = `mongodb://${mongoContainer.getContainerIpAddress()}:${mongoContainer.getMappedPort(
							27017,
						)}/clinical`;
						return dbUrl;
					},
					initialSchemaVersion() {
						return startingSchemaVersion;
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
						return `file://${__dirname}/migration-stub-schema.json`;
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
				console.error('before >>>>>>>>>>>', err);
				return err;
			}
		})();
	});

	after(async () => {
		await mongoose.disconnect();
		await mongoContainer.stop();
		await mysqlContainer.stop();
	});

	beforeEach(async () => {
		await clearCollections(dbUrl, ['donors', 'dictionarymigrations', 'dataschemas']);
		await insertData(dbUrl, 'donors', donor);
		await insertData(dbUrl, 'donors', donor2);
		// reset the base schema since tests can load new one
		await bootstrap.loadSchema(schemaName, startingSchemaVersion);
		sendProgramUpdatedMessageFunc = spy(getInstance(), 'sendProgramUpdatedMessage');
	});

	afterEach(() => {
		sendProgramUpdatedMessageFunc.restore();
	});

	const MIGRATION_FAIL_STAGE: MigrationStage = 'FAILED';
	const MIGRATION_ERROR_PROPERTY: keyof DictionaryMigration = 'newSchemaErrors';

	const assertSuccessfulMigration = async (res: any, version: string) => {
		res.should.have.status(200);
		const schema = (await findInDb(
			dbUrl,
			'dataschemas',
			{},
		)) as dictionaryEntities.SchemasDictionary[];
		schema[0].version.should.eq(version);
	};

	// no fundamental migration rejections
	const assertNoMigrationErrors = (res: any, version: string) => {
		const [migration] = res.body;
		migration.toVersion.should.equal(version);
		migration.state.should.not.equal(MIGRATION_FAIL_STAGE);
		migration.should.not.have.property(MIGRATION_ERROR_PROPERTY);
	};

	// no fundamental migration rejections, AND no errors to any donors
	const assertNoDonorImpacts = (res: any, version: string) => {
		const [migration] = res.body;

		assertNoMigrationErrors(res, version);
		migration.invalidDonorsErrors.should.be.empty;
		migration.invalidSubmissions.should.be.empty;
	};

	const assertMigrationErrors = (res: any, version: string) => {
		const [migration] = res.body;
		migration.toVersion.should.equal(version);
		migration.should.have.property(MIGRATION_ERROR_PROPERTY);
	};

	describe('Changes which should not affect existing donors', () => {
		it('should update the schema after a new enum value was added', async () => {
			const VERSION = '4.0';
			await migrateSyncTo(VERSION).then(async (res: any) => {
				await assertSuccessfulMigration(res, VERSION);
			});
			const res = await getAllMigrationDocs();
			assertNoDonorImpacts(res, VERSION);
		});
		it('should update the schema after a new non-required field was added', async () => {
			const VERSION = '5.0';
			await migrateSyncTo(VERSION).then(async (res: any) => {
				await assertSuccessfulMigration(res, VERSION);
			});
			const res = await getAllMigrationDocs();
			assertNoDonorImpacts(res, VERSION);
		});
		it('should update the schema after a new file was added', async () => {
			const VERSION = '6.0';
			await migrateSyncTo(VERSION).then(async (res: any) => {
				await assertSuccessfulMigration(res, VERSION);
			});
			const res = await getAllMigrationDocs();
			assertNoDonorImpacts(res, VERSION);
		});
		it('should allow schema field value type to change from integer to number', async () => {
			const VERSION = '16.0';
			await migrateSyncTo(VERSION).then(async (res: any) => {
				await assertSuccessfulMigration(res, VERSION);
			});
			const res = await getAllMigrationDocs();
			assertNoDonorImpacts(res, VERSION);
		});
	});

	describe('Changes that can affect existing donors', () => {
		it('should run migration and add clinical info completion for donor entity', async () => {
			const donorInvalidWithNewSchema = emptyDonorDocument({
				submitterId: 'ICGC_0004',
				programId,
				clinicalInfo: {
					program_id: 'ABCD-EF',
					submitter_donor_id: 'ICGC_0004',
					vital_status: 'Unknown', // migration will find this to be invalid
					cause_of_death: 'Died of cancer',
					survival_time: 67,
				},
				completionStats: {
					coreCompletion: {
						donor: 1,
						primaryDiagnosis: 0,
						treatments: 0,
						followUps: 0,
						specimens: 0,
					},
					coreCompletionPercentage: 16.6,
					hasMissingEntityException: false,
				},
			});
			await insertData(dbUrl, 'donors', donorInvalidWithNewSchema);
			await migrateSyncTo('4.0').then((res: any) => {
				res.should.have.status(200);
			});
			const updatedDonor = await findInDb(dbUrl, 'donors', {});

			// donor 1 stats after migration, added entity completion
			chai.expect(updatedDonor[0].completionStats.coreCompletion).to.deep.include({
				donor: 1,
				primaryDiagnosis: 0,
				treatments: 0,
				followUps: 0,
				specimens: 0,
			});
			// donor 2 stats after migraiton
			chai.expect(updatedDonor[1].completionStats.coreCompletion).to.deep.include({
				donor: 1,
				primaryDiagnosis: 1,
				treatments: 0,
				followUps: 0,
				specimens: 0,
			});
			// donor 3 stats after migraiton
			chai.expect(updatedDonor[2].completionStats.coreCompletion).to.deep.include({
				donor: 1,
				primaryDiagnosis: 0,
				treatments: 0,
				followUps: 0,
				specimens: 0,
			});
			chai.expect(updatedDonor[2].completionStats.hasMissingEntityException).to.deep.eq(false);

			chai.assert(sendProgramUpdatedMessageFunc.calledOnceWith({ programId }));
		});
		it('should update the schema after an enum option was removed, and make donor2 invalid', async () => {
			const VERSION = '7.0';
			await migrateSyncTo(VERSION).then(async (res: any) => {
				await assertSuccessfulMigration(res, VERSION);
			});

			const res = await getAllMigrationDocs();

			const [migration] = res.body;

			assertNoMigrationErrors(res, VERSION);

			migration.invalidDonorsErrors.length.should.equal(1);

			const presentingSymptomError =
				migration.invalidDonorsErrors[0].errors[0].primary_diagnosis[0];
			chai.expect(presentingSymptomError).to.deep.include({
				errorType: dictionaryEntities.SchemaValidationErrorTypes.INVALID_ENUM_VALUE,
				fieldName: PRESENTING_SYMPTOMS,
				info: { value: ['Nausea'] },
			});
		});

		it('should update the schema after a new required field is added, and make all donors invalid', async () => {
			const VERSION = '8.0';
			await migrateSyncTo('8.0').then(async (res: any) => {
				await assertSuccessfulMigration(res, VERSION);
			});

			const res = await getAllMigrationDocs();
			const donors = await findInDb(dbUrl, 'donors', {});

			const [migration] = res.body;
			assertNoMigrationErrors(res, VERSION);

			// brand new required field should invalidate every existing donor
			migration.invalidDonorsErrors.length.should.equal(donors.length);
			migration.invalidDonorsErrors.forEach((donorErrObj: { errors: { donor: any[] }[] }) => {
				const errorObj = donorErrObj.errors[0].donor[0];
				chai
					.expect(errorObj)
					.to.have.property(
						'errorType',
						dictionaryEntities.SchemaValidationErrorTypes.MISSING_REQUIRED_FIELD,
					);
				chai.expect(errorObj).to.have.property('fieldName', 'eye_colour');
			});
			migration.stats.invalidDocumentsCount.should.equal(donors.length);
		});

		it('should not update the schema after a required field is removed', async () => {
			/* This test covers a single field, however, outcomes may be highly variable depending on
      how other parts of the codebase are dependent on a particular removed field */

			/* Although spec doesn't explicity state this change as prohibited, migration logic is refusing the change.
      Failing to provide the field is a breaking change */
			const VERSION = '9.0';
			await migrateSyncTo(VERSION).then(async (res: any) => {
				res.should.have.status(200);
				const schema = (await findInDb(
					dbUrl,
					'dataschemas',
					{},
				)) as dictionaryEntities.SchemasDictionary[];
				// migration will fail
				schema[0].version.should.eq(startingSchemaVersion);
			});

			const res = await getAllMigrationDocs();
			const [migration] = res.body;
			assertMigrationErrors(res, VERSION);

			migration.newSchemaErrors.should.deep.eq({
				[ClinicalEntitySchemaNames.DONOR]: {
					missingFields: [DonorFieldsEnum.cause_of_death],
					invalidFieldCodeLists: [],
					valueTypeChanges: [],
				},
			});
		});
		it('should update the schema after regex and script changes invalidate donor2', async () => {
			const VERSION = '10.0';
			await migrateSyncTo(VERSION).then(async (res: any) => {
				await assertSuccessfulMigration(res, VERSION);
			});

			const res = await getAllMigrationDocs();

			const [migration] = res.body;
			assertNoMigrationErrors(res, VERSION);

			const errorObj = migration.invalidDonorsErrors[0].errors[0];
			errorObj.should.have.property(ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS);
			chai
				.expect(errorObj.primary_diagnosis[0])
				.to.have.property(
					'errorType',
					dictionaryEntities.SchemaValidationErrorTypes.INVALID_BY_REGEX,
				);
			chai
				.expect(errorObj.primary_diagnosis[0])
				.to.have.property('fieldName', PrimaryDiagnosisFieldsEnum.cancer_type_code);

			chai
				.expect(errorObj.primary_diagnosis[1])
				.to.have.property(
					'errorType',
					dictionaryEntities.SchemaValidationErrorTypes.INVALID_BY_SCRIPT,
				);
			chai
				.expect(errorObj.primary_diagnosis[1])
				.to.have.property('fieldName', PrimaryDiagnosisFieldsEnum.age_at_diagnosis);
		});
	});

	describe('Prohibited changes which should be rejected', () => {
		it('should check new schema is valid with data validation fields', async () => {
			await migrateSyncTo('15.0');
			const res = await getAllMigrationDocs();
			const [migration] = res.body;

			assertMigrationErrors(res, '15.0');

			migration.newSchemaErrors.should.deep.eq({
				[ClinicalEntitySchemaNames.REGISTRATION]: {
					missingFields: [SampleRegistrationFieldsEnum.specimen_type],
					invalidFieldCodeLists: [],
					valueTypeChanges: [],
				},
			});
		});

		it('should reject the new schema where the field value type was changed', async () => {
			// https://github.com/icgc-argo/argo-clinical/issues/446
			await migrateSyncTo('14.0');
			const res = await getAllMigrationDocs();
			const [migration] = res.body;

			assertMigrationErrors(res, '14.0');

			migration.newSchemaErrors.should.deep.eq({
				[ClinicalEntitySchemaNames.REGISTRATION]: {
					missingFields: [],
					invalidFieldCodeLists: [],
					valueTypeChanges: [
						SampleRegistrationFieldsEnum.program_id,
						SampleRegistrationFieldsEnum.submitter_donor_id,
					],
				},
				[ClinicalEntitySchemaNames.DONOR]: {
					missingFields: [],
					invalidFieldCodeLists: [],
					valueTypeChanges: [DonorFieldsEnum.program_id, DonorFieldsEnum.submitter_donor_id],
				},
			});
		});

		it('should reject the new schema where the field name was changed', async () => {
			// renaming a field currently is currently seen as removing the field
			// how the change is analyzed and what error state to produce is subject to change
			const VERSION = '12.0';
			await migrateSyncTo(VERSION);
			const res = await getAllMigrationDocs();

			const [migration] = res.body;
			assertMigrationErrors(res, VERSION);

			migration.newSchemaErrors.should.deep.eq({
				[ClinicalEntitySchemaNames.DONOR]: {
					missingFields: [DonorFieldsEnum.program_id],
					invalidFieldCodeLists: [],
					valueTypeChanges: [],
				},
			});

			migration.stage.should.equal(MIGRATION_FAIL_STAGE);
		});

		it('should reject migration when a schema is removed', async () => {
			// https://github.com/icgc-argo/argo-clinical/issues/466
			// the removal of a schema, is currently just considered as removal of all the fields
			// how this change is analyzed and what error state to produce is subject to change
			const VERSION = '13.0';
			await migrateSyncTo(VERSION).then((res: any) => {
				res.should.have.status(500);
				res.body.message.should.eq(
					'New dictionary is missing schema: hormone_therapy, please make sure the dictinary contains all clinical entities.',
				);
			});
		});
	});

	describe('dry run migration api', () => {
		it('should report donor validation errors', async () => {
			await insertData(dbUrl, 'donors', newSchemaInvalidDonor);

			await dryRunMigrateTo('7.0').then(async (res: any) => {
				res.should.have.status(200);
				const migration = res.body as DictionaryMigration;
				migration.should.not.be.undefined;
				const migrations = (await findInDb(
					dbUrl,
					'dictionarymigrations',
					{},
				)) as DictionaryMigration[];
				migrations.should.not.be.empty;
				migrations[0].should.not.be.undefined;
				const dbMigration = migrations[0];
				if (!dbMigration._id) {
					throw new Error('migration in db with no id');
				}
				dbMigration._id = dbMigration._id.toString();
				// we convert to json string to normalize dates
				const normalizedDbMigration = JSON.parse(JSON.stringify(dbMigration));
				normalizedDbMigration.should.deep.include(migration);
				migration.stats.invalidDocumentsCount.should.eq(1);
				migration.stats.validDocumentsCount.should.eq(2);
				migration.stats.totalProcessed.should.eq(3);
				migration.invalidDonorsErrors[0].should.deep.eq({
					donorId: 1,
					submitterDonorId: 'ICGC_0003',
					programId: 'ABCD-EF',
					errors: [
						{
							primary_diagnosis: [
								{
									errorType: 'INVALID_ENUM_VALUE',
									fieldName: 'presenting_symptoms',
									index: 0,
									info: {
										value: ['Nausea'],
									},
									message: 'The value is not permissible for this field.',
								},
							],
						},
					],
				});

				chai.assert(sendProgramUpdatedMessageFunc.notCalled);
			});
		});
	});
});

const migrateSyncTo = async (newSchemaVersion: string) => {
	return chai
		.request(app)
		.post('/dictionary/migration/run?sync=true')
		.auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
		.send({
			version: newSchemaVersion,
		});
};

const dryRunMigrateTo = async (newSchemaVersion: string) => {
	return chai
		.request(app)
		.post('/dictionary/migration/dry-run-update')
		.auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
		.send({
			version: newSchemaVersion,
		});
};

const getAllMigrationDocs = async () => {
	return await chai
		.request(app)
		.get('/dictionary/migration')
		.auth(JWT_CLINICALSVCADMIN, { type: 'bearer' });
};
