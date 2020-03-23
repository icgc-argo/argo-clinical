import app from '../../../src/app';
import * as bootstrap from '../../../src/bootstrap';
import { ClinicalEntitySchemaNames } from '../../../src/submission/submission-entities';
import { DonorFieldsEnum } from '../../../src/submission/submission-entities';
import { SampleRegistrationFieldsEnum } from '../../../src/submission/submission-entities';
import { SchemasDictionary } from '../../../src/lectern-client/schema-entities';
import { DictionaryMigration } from '../../../src/submission/schema/migration-entities';
import { Donor } from '../../../src/clinical/clinical-entities';
import { getInstance } from '../../../src/submission/submission-updates-messenger';

import chai from 'chai';
import 'chai-http';
import 'deep-equal-in-any-order';
import 'mocha';
import mongoose from 'mongoose';
import { spy, SinonSpy } from 'sinon';
import { GenericContainer } from 'testcontainers';
import { findInDb, insertData, emptyDonorDocument, clearCollections } from '../testutils';
import { TEST_PUB_KEY, JWT_CLINICALSVCADMIN } from '../test.jwt';
import _ from 'lodash';

chai.use(require('chai-http'));
chai.use(require('deep-equal-in-any-order'));
chai.should();

const schemaName = 'ARGO Clinical Submission';
const startingSchemaVersion = '1.0';

describe('schema migration api', () => {
  let sendProgramUpdatedMessageFunc: SinonSpy<[string], Promise<void>>;
  let mongoContainer: any;
  let dburl = ``;

  const programId = 'ABCD-EF';
  const donor: Donor = emptyDonorDocument({
    submitterId: 'ICGC_0001',
    programId,
    clinicalInfo: {
      program_id: 'ABCD-EF',
      vital_status: 'Deceased',
      cause_of_death: 'Unknown',
      submitter_donor_id: 'ICGC_0001',
      survival_time: 120,
    },
    clinicalInfoStats: {
      submittedCoreFields: 3,
      expectedCoreFields: 3,
      submittedExtendedFields: 0,
      expectedExtendedFields: 0,
    },
    aggregatedInfoStats: {
      submittedCoreFields: 3,
      expectedCoreFields: 3,
      submittedExtendedFields: 0,
      expectedExtendedFields: 0,
    },
  });

  const donor2: Donor = emptyDonorDocument({
    submitterId: 'ICGC_0003',
    programId,
    clinicalInfo: {
      program_id: 'ABCD-EF',
      vital_status: 'Alive',
      cause_of_death: 'Died of cancer',
      submitter_donor_id: 'ICGC_0003',
      survival_time: 67,
    },
    clinicalInfoStats: {
      submittedCoreFields: 3,
      expectedCoreFields: 3,
      submittedExtendedFields: 0,
      expectedExtendedFields: 0,
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
      },
    ],
    primaryDiagnosis: {
      clinicalInfo: {
        program_id: 'PACA-AU',
        submitter_donor_id: 'ICGC_0003',
        number_lymph_nodes_examined: 2,
        age_at_diagnosis: 96,
        cancer_type_code: 'A11.1A',
        tumour_staging_system: 'Murphy',
      },
      clinicalInfoStats: {
        submittedCoreFields: 2,
        expectedCoreFields: 7,
        submittedExtendedFields: 0,
        expectedExtendedFields: 0,
      },
    },
    aggregatedInfoStats: {
      submittedCoreFields: 5,
      expectedCoreFields: 10,
      submittedExtendedFields: 0,
      expectedExtendedFields: 0,
    },
  });

  const newSchemaInvalidDonor: Donor = emptyDonorDocument({
    submitterId: 'ICGC_0002',
    programId,
    clinicalInfo: {
      program_id: 'ABCD-EF',
      vital_status: 'Unknown',
      cause_of_death: 'Died of cancer',
      submitter_donor_id: 'ICGC_0002',
      survival_time: 67,
    },
  });

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
            return `file://${__dirname}/stub-schema.json`;
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

  beforeEach(async () => {
    await clearCollections(dburl, ['donors', 'dictionarymigrations', 'dataschemas']);
    await insertData(dburl, 'donors', donor);
    await insertData(dburl, 'donors', donor2);
    // reset the base schema since tests can load new one
    await bootstrap.loadSchema(schemaName, startingSchemaVersion);
    sendProgramUpdatedMessageFunc = spy(getInstance(), 'sendProgramUpdatedMessage');
  });

  afterEach(() => {
    sendProgramUpdatedMessageFunc.restore();
  });

  // very simple smoke test of the migration to be expanded along developement
  it('should update the schema', async () => {
    await migrateSyncTo('2.0').then(async (res: any) => {
      res.should.have.status(200);

      const schema = (await findInDb(dburl, 'dataschemas', {})) as SchemasDictionary[];
      schema[0].version.should.eq('2.0');
    });

    await getAllMigrationDocs().then(async (res: any) => {
      res.should.have.status(200);
      res.body.length.should.eq(1);
      const migrationId = res.body[0]._id;
      const migrations = (await findInDb(
        dburl,
        'dictionarymigrations',
        {},
      )) as DictionaryMigration[];
      migrations.should.not.be.empty;
      migrations[0].should.not.be.undefined;
      if (!migrations[0]._id) {
        throw new Error('migration in db with no id');
      }
      migrations[0]._id.toString().should.eq(migrationId);
      migrations[0].invalidDonorsErrors.length.should.eq(0);
      migrations[0].stats.validDocumentsCount.should.eq(2);
      chai.assert(sendProgramUpdatedMessageFunc.calledOnceWith(programId));
    });
  });

  it('should check new schema is valid with data validation fields', async () => {
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

  it('should run migration and update all donor entity clincial info stats', async () => {
    const donorWithNoStats = emptyDonorDocument({
      submitterId: 'ICGC_0004',
      programId,
      clinicalInfo: {
        program_id: 'ABCD-EF',
        submitter_donor_id: 'ICGC_0004',
        vital_status: 'Deceased',
        cause_of_death: 'Died of cancer',
        survival_time: 67,
      },
    });
    await insertData(dburl, 'donors', donorWithNoStats);

    const donors = await findInDb(dburl, 'donors', {});

    // donor 1 stats before migration
    chai.expect(donors[0].aggregatedInfoStats).to.deep.include({
      submittedCoreFields: 3,
      expectedCoreFields: 3,
    });
    // donor 2 stats before migration
    chai.expect(donors[1].aggregatedInfoStats).to.deep.include({
      submittedCoreFields: 5,
      expectedCoreFields: 10,
    });
    chai.expect(donors[1].primaryDiagnosis.clinicalInfoStats).to.deep.include({
      submittedCoreFields: 2,
      expectedCoreFields: 7,
    });
    // this donor has no stats currently but it has clinicalInfos (which will remain schema valid), so migration should add them
    chai.expect(donors[2].aggregatedInfoStats).to.deep.eq(undefined);

    await migrateSyncTo('2.0').then(async (res: any) => {
      res.should.have.status(200);
      const updatedDonor = await findInDb(dburl, 'donors', {});

      // donor 1 stats after migraiton
      chai.expect(updatedDonor[0].aggregatedInfoStats).to.deep.include({
        submittedCoreFields: 2,
        expectedCoreFields: 2,
      });
      // donor 2 stats after migraiton
      chai.expect(updatedDonor[1].aggregatedInfoStats).to.deep.include({
        submittedCoreFields: 5,
        expectedCoreFields: 10,
      });
      // this stub schema has also turned an existing required field to core in primary diagnosis
      chai.expect(updatedDonor[1].primaryDiagnosis.clinicalInfoStats).to.deep.include({
        submittedCoreFields: 3,
        expectedCoreFields: 8,
      });
      // donor 3 stats after migraiton, now has recently calculated stats, including the one without any stats
      chai.expect(updatedDonor[2].aggregatedInfoStats).to.deep.include({
        submittedCoreFields: 2,
        expectedCoreFields: 2,
      });

      chai.assert(sendProgramUpdatedMessageFunc.calledOnceWith(programId));
    });
  });

  describe('dry run migration api', () => {
    it('should report donor validation errors', async () => {
      await insertData(dburl, 'donors', newSchemaInvalidDonor);

      await dryRunMigrateTo('2.0').then(async (res: any) => {
        res.should.have.status(200);
        const migration = res.body as DictionaryMigration;
        migration.should.not.be.undefined;
        const migrations = (await findInDb(
          dburl,
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
          submitterDonorId: 'ICGC_0002',
          programId: 'ABCD-EF',
          errors: [
            {
              donor: [
                {
                  errorType: 'INVALID_ENUM_VALUE',
                  fieldName: 'vital_status',
                  index: 0,
                  info: {},
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
    .patch('/submission/schema/?sync=true')
    .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
    .send({
      version: newSchemaVersion,
    });
};

const dryRunMigrateTo = async (newSchemaVersion: string) => {
  return chai
    .request(app)
    .post('/submission/schema/dry-run-update')
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
