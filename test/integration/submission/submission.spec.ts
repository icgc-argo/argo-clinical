// using import fails when running the test
// import * as chai from "chai";
import chai from 'chai';
import mongo from 'mongodb';
import fs from 'fs';
// needed for types
import 'chai-http';
import 'deep-equal-in-any-order';
import 'mocha';
import mongoose from 'mongoose';
import { GenericContainer } from 'testcontainers';
import app from '../../../src/app';
import * as bootstrap from '../../../src/bootstrap';
import {
  cleanCollection,
  insertData,
  emptyDonorDocument,
  resetCounters,
  generateDonor,
  assertDbCollectionEmpty,
  findInDb,
  createDonorDoc,
  createtRxNormTables,
  insertRxNormDrug,
  updateData,
} from '../testutils';
import * as mysql from 'mysql';
import { TEST_PUB_KEY, JWT_CLINICALSVCADMIN, JWT_ABCDEF, JWT_WXYZEF } from '../test.jwt';
import {
  ActiveRegistration,
  ActiveClinicalSubmission,
  SampleRegistrationFieldsEnum,
  SUBMISSION_STATE,
  DataValidationErrors,
  SubmissionBatchErrorTypes,
  ClinicalEntitySchemaNames,
  DonorFieldsEnum,
  ClinicalUniqueIdentifier,
  ClinicalEntities,
} from '../../../src/submission/submission-entities';
import { TsvUtils } from '../../../src/utils';
import { donorDao } from '../../../src/clinical/donor-repo';
import { Donor, Specimen } from '../../../src/clinical/clinical-entities';
import AdmZip from 'adm-zip';
import _ from 'lodash';
import chaiExclude from 'chai-exclude';
chai.use(require('chai-http'));
chai.use(require('deep-equal-in-any-order'));
chai.use(chaiExclude);
chai.should();

const baseDonorId = 250000;
const baseSampleId = 610000;
const baseSpecimenId = 210000;
const schemaName = 'ARGO Clinical Submission';
const schemaVersion = '1.0';
const stubFilesDir = __dirname + `/stub_clinical_files`;

const RXNORM_DB = 'rxnorm';
const RXNORM_USER = 'clinical';
const RXNORM_PASS = 'password';

describe('Submission Api', () => {
  let dburl = ``;
  let mongoContainer: any;
  let mysqlContainer: any;
  // will run when all tests are finished
  before(() => {
    return (async () => {
      try {
        mongoContainer = await new GenericContainer('mongo').withExposedPorts(27017).start();
        mysqlContainer = await new GenericContainer('mysql', '5.5')
          .withEnv('MYSQL_DATABASE', RXNORM_DB)
          .withEnv('MYSQL_USER', RXNORM_USER)
          .withEnv('MYSQL_ROOT_PASSWORD', RXNORM_PASS)
          .withEnv('MYSQL_PASSWORD', RXNORM_PASS)
          .withExposedPorts(3306)
          .start();
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
              database: RXNORM_DB,
              user: RXNORM_USER,
              password: RXNORM_PASS,
              timeout: 5000,
              host: mysqlContainer.getContainerIpAddress(),
              port: mysqlContainer.getMappedPort(3306),
            };
          },
        });
        const rxnormDbConnection = mysql.createPool({
          database: RXNORM_DB,
          user: RXNORM_USER,
          password: RXNORM_PASS,
          host: mysqlContainer.getContainerIpAddress(),
          port: mysqlContainer.getMappedPort(3306),
        });
        await createtRxNormTables(rxnormDbConnection);
        await insertRxNormDrug('423', 'drugA', rxnormDbConnection);
        await insertRxNormDrug('423', 'drug A', rxnormDbConnection);
        await insertRxNormDrug('423', 'Koolaid', rxnormDbConnection);
        await insertRxNormDrug('22323', 'drug 2', rxnormDbConnection);
        await insertRxNormDrug('22323', 'drug B', rxnormDbConnection);
        await insertRxNormDrug('12', '123-H2O', rxnormDbConnection);
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

  describe('registration', function() {
    this.beforeEach(async () => {
      await clearCollections(dburl, ['donors', 'activeregistrations', 'counters']);
    });

    it('should return 200 and empty json if no registration found', function(done) {
      chai
        .request(app)
        .get('/submission/program/ABCD-EF/registration')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(200);
          res.body.should.deep.eq({});
          done();
        });
    });

    it('should return 401 for missing token', function(done) {
      chai
        .request(app)
        .get('/submission/program/NONE-EX/registration')
        .end((err: any, res: any) => {
          res.should.have.status(401);
          done();
        });
    });

    it('GET should return 403 for wrong scope', function(done) {
      chai
        .request(app)
        .get('/submission/program/NONE-EX/registration')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(403);
          done();
        });
    });

    it("should return 403 requested program doesn't match authorized in token scopes", done => {
      let file: Buffer;
      try {
        file = fs.readFileSync(stubFilesDir + `/${ClinicalEntitySchemaNames.REGISTRATION}.tsv`);
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        // passing token with different program
        .auth(JWT_WXYZEF, { type: 'bearer' })
        .type('form')
        .attach('registrationFile', file, `${ClinicalEntitySchemaNames.REGISTRATION}.tsv`)
        .end((err: any, res: any) => {
          res.should.have.status(403);
          done();
        });
    });

    it('should commit registration, create donors', done => {
      let file: Buffer;
      let file2: Buffer;
      let rows: any[];

      try {
        file = fs.readFileSync(stubFilesDir + `/${ClinicalEntitySchemaNames.REGISTRATION}.1.tsv`);
        (async () =>
          (rows = (await TsvUtils.tsvToJson(
            stubFilesDir + `/${ClinicalEntitySchemaNames.REGISTRATION}.1.tsv`,
          )) as any[]))();
      } catch (err) {
        return done(err);
      }

      try {
        file2 = fs.readFileSync(stubFilesDir + `/${ClinicalEntitySchemaNames.REGISTRATION}.2.tsv`);
      } catch (err) {
        return done(err);
      }

      chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .type('form')
        .attach('registrationFile', file, `${ClinicalEntitySchemaNames.REGISTRATION}.1.tsv`)
        .end(async (err: any, res: any) => {
          try {
            await assertUploadOKRegistrationCreated(res, dburl);
            const reg1Id = res.body.registration._id;
            chai
              .request(app)
              .post(`/submission/program/ABCD-EF/registration/${reg1Id}/commit`)
              .auth(JWT_ABCDEF, { type: 'bearer' })
              .end(async (err: any, res: any) => {
                try {
                  await assertFirstCommitDonorsCreatedInDB(res, rows, dburl);
                  chai
                    .request(app)
                    .post('/submission/program/ABCD-EF/registration')
                    .auth(JWT_ABCDEF, { type: 'bearer' })
                    .type('form')
                    .attach(
                      'registrationFile',
                      file2,
                      `${ClinicalEntitySchemaNames.REGISTRATION}.2.tsv`,
                    )
                    .end(async (err: any, res: any) => {
                      try {
                        await assertUploadOKRegistrationCreated(res, dburl);
                        const regId = res.body.registration._id;
                        chai
                          .request(app)
                          .post(`/submission/program/ABCD-EF/registration/${regId}/commit`)
                          .auth(JWT_ABCDEF, { type: 'bearer' })
                          .end(async (err: any, res: any) => {
                            try {
                              await assert2ndCommitNewSamplesDetected(res);
                              return done();
                            } catch (err) {
                              return done(err);
                            }
                          });
                      } catch (err) {
                        return done(err);
                      }
                    });
                } catch (err) {
                  return done(err);
                }
              });
          } catch (err) {
            return done(err);
          }
        });
    });

    it('should commit registration, detect already registered', async () => {
      let file: Buffer;
      let rows: any[] = [];
      try {
        file = fs.readFileSync(stubFilesDir + `/${ClinicalEntitySchemaNames.REGISTRATION}.1.tsv`);
        (async () =>
          (rows = (await TsvUtils.tsvToJson(
            stubFilesDir + `/${ClinicalEntitySchemaNames.REGISTRATION}.1.tsv`,
          )) as any[]))();
      } catch (err) {
        return err;
      }
      const conn = await mongo.connect(dburl);
      const existingDonors: ActiveRegistration | null = await conn
        .db('clinical')
        .collection('donors')
        .findOne({});
      console.log(JSON.stringify(existingDonors));
      const response1 = await chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .type('form')
        .attach('registrationFile', file, `${ClinicalEntitySchemaNames.REGISTRATION}.1.tsv`)
        .then((res: any) => {
          try {
            chai.expect(res.body.registration.stats.newSampleIds).to.deep.eq([
              { submitterId: 'sm123-4', rowNumbers: [0] },
              { submitterId: 'sm123-5', rowNumbers: [1] },
              { submitterId: 'sm123-6', rowNumbers: [2] },
              { submitterId: 'sm123-7', rowNumbers: [3] },
            ]);
            return res;
          } catch (err) {
            return err;
          }
        });

      await assertUploadOKRegistrationCreated(response1, dburl);
      const reg1Id = response1.body.registration._id;
      const commit1Response = await chai
        .request(app)
        .post(`/submission/program/ABCD-EF/registration/${reg1Id}/commit`)
        .auth(JWT_ABCDEF, { type: 'bearer' });
      await assertFirstCommitDonorsCreatedInDB(commit1Response, rows, dburl);
      const reg2Response = await chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .type('form')
        .attach('registrationFile', file, `${ClinicalEntitySchemaNames.REGISTRATION}.1.tsv`)
        .then((res: any) => {
          try {
            const reg2Id = res.body.registration._id;
            chai.expect(reg2Id).to.not.eq(reg1Id);
            chai.expect(res.body.registration.stats.newSampleIds).to.deep.eq([]);
            chai.expect(res.body.registration.stats.alreadyRegistered).to.deep.eq([
              { submitterId: 'sm123-4', rowNumbers: [0] },
              { submitterId: 'sm123-5', rowNumbers: [1] },
              { submitterId: 'sm123-6', rowNumbers: [2] },
              { submitterId: 'sm123-7', rowNumbers: [3] },
            ]);
            return res;
          } catch (err) {
            return err;
          }
        });
      await assertUploadOKRegistrationCreated(reg2Response, dburl);
      const reg2Id = reg2Response.body.registration._id;
      const commit2 = await chai
        .request(app)
        .post(`/submission/program/ABCD-EF/registration/${reg2Id}/commit`)
        .auth(JWT_ABCDEF, { type: 'bearer' });
      await asserCommitExistingSamplesOK(commit2);
    });

    it('should accept valid registration tsv', done => {
      let file: Buffer;
      try {
        file = fs.readFileSync(stubFilesDir + `/${ClinicalEntitySchemaNames.REGISTRATION}.tsv`);
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .type('form')
        .attach('registrationFile', file, `${ClinicalEntitySchemaNames.REGISTRATION}.tsv`)
        .end(async (err: any, res: any) => {
          try {
            res.should.have.status(201);
            const conn = await mongo.connect(dburl);
            const savedRegistration: ActiveRegistration | null = await conn
              .db('clinical')
              .collection('activeregistrations')
              .findOne({});
            await conn.close();
            if (!savedRegistration) {
              throw new Error("saved registration shouldn't be null");
            }
            chai.expect(savedRegistration.programId).to.eq('ABCD-EF');
            chai.expect(savedRegistration.stats).to.deep.eq(expectedResponse1.registration.stats);
            res.body.errors.length.should.eq(0);
            res.body.registration.creator.should.eq('Test User');
            res.body.registration.records.should.deep.eq(expectedResponse1.registration.records);
            res.body.registration._id.should.be.a('string');
            res.body.registration.programId.should.eq(expectedResponse1.registration.programId);
            res.body.registration.stats.should.deep.eq(expectedResponse1.registration.stats);
          } catch (err) {
            return done(err);
          }
          return done();
        });
    });

    it('should not accept invalid registration tsv and clear existing active registration', async () => {
      await insertData(dburl, 'activeregistrations', ABCD_REGISTRATION_DOC);
      let file: Buffer;
      try {
        file = fs.readFileSync(
          stubFilesDir + `/${ClinicalEntitySchemaNames.REGISTRATION}.invalid.tsv`,
        );
      } catch (err) {
        throw err;
      }
      const result = await chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        .type('form')
        .attach('registrationFile', file, `${ClinicalEntitySchemaNames.REGISTRATION}.invalid.tsv`)
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .then((res: any) => {
          res.should.have.status(422);
          res.body.should.deep.include({
            batchErrors: expectedErrors,
            successful: false,
          });
        });
      await assertDbCollectionEmpty(dburl, 'activeregistration');
    });

    it('should not accept invalid file names', done => {
      let file: Buffer;
      try {
        file = fs.readFileSync(stubFilesDir + '/thisIsARegistration.tsv');
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        .type('form')
        .attach('registrationFile', file, 'thisIsARegistration.tsv')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end((err: any, res: any) => {
          try {
            res.should.have.status(422);
            res.body.batchErrors.should.deep.include({
              message: `Improperly named files cannot be uploaded or validated. Please retain the template file name and only append characters to the end (e.g. sample_registration<_optional_extension>.tsv).`,
              code: SubmissionBatchErrorTypes.INVALID_FILE_NAME,
              batchNames: ['thisIsARegistration.tsv'],
            });
          } catch (err) {
            return done(err);
          }
          return done();
        });
    });

    it('should not accept tsv files with invalid headers', done => {
      let file: Buffer;
      try {
        file = fs.readFileSync(stubFilesDir + '/sample_registration-invalidHeaders.tsv');
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        .type('form')
        .attach('registrationFile', file, 'sample_registration-invalidHeaders.tsv')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end(async (err: any, res: any) => {
          try {
            res.should.have.status(422);
            res.body.batchErrors.should.deep.include({
              message: `Missing required headers: [program_id], [submitter_specimen_id]`,
              code: SubmissionBatchErrorTypes.MISSING_REQUIRED_HEADER,
              batchNames: ['sample_registration-invalidHeaders.tsv'],
            });
            res.body.batchErrors.should.deep.include({
              message: `Found unknown headers: [prgram_id], [submittr_specimen_id]`,
              code: SubmissionBatchErrorTypes.UNRECOGNIZED_HEADER,
              batchNames: ['sample_registration-invalidHeaders.tsv'],
            });
          } catch (err) {
            return done(err);
          }
          return done();
        });
    });

    it('Registration should return 404 if try to delete non exsistent registration', done => {
      chai
        .request(app)
        // data base is empty so ID shouldn't exist
        .delete('/submission/program/ABCD-EF/registration/5d51800c9014b11151d419cf')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(404);
          done();
        });
    });

    it('Registration should return 200 if deleted existing registration', async () => {
      const registrationId = await insertData(dburl, 'activeregistrations', ABCD_REGISTRATION_DOC);
      await chai
        .request(app)
        .delete('/submission/program/ABCD-EF/registration/' + registrationId)
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .then((res: any) => {
          try {
            res.should.have.status(200);
          } catch (err) {
            throw err;
          }
        });
      await assertDbCollectionEmpty(dburl, 'activeregistration');
    });
  });

  describe('icgc import', function() {
    this.beforeEach(async () => {
      await clearCollections(dburl, ['donors', 'counters']);
    });

    it('should import legacy samples file', async () => {
      let file: Buffer;
      let rows: any[];
      try {
        // this file contains 39 rows (samples)
        // 35 unique donors
        // 38 unique specimens
        file = fs.readFileSync(stubFilesDir + `/paca.icgc.samples.tsv`);
        rows = (await TsvUtils.tsvToJson(stubFilesDir + `/paca.icgc.samples.tsv`)) as any;
      } catch (err) {
        return err;
      }

      const response = await chai
        .request(app)
        .post('/submission/icgc-import/preprocess/ABCD-EF')
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .type('form')
        .attach('samples', file, `paca.icgc.samples.tsv`)
        .then(res => {
          return res;
        });

      response.should.have.status(200);
      // there should be 35 unique donors
      response.body.length.should.eq(35);
      const sps = new Set<string>();
      let donorToVerify: Donor | undefined;
      response.body.forEach((d: Donor) => {
        if (d.donorId == 35239) {
          donorToVerify = d;
        }
        d.specimens.forEach(s => sps.add(s.submitterId));
      });

      if (donorToVerify === undefined) {
        throw new Error('didnt find the donor to verify');
      }
      chai.expect(donorToVerify).to.deep.eq({
        donorId: 35239,
        gender: 'Other',
        programId: 'ABCD-EF',
        specimens: [
          {
            specimenId: 78151,
            submitterId: 'PCSI_0127_Pa_P',
            clinicalInfo: {},
            tumourNormalDesignation: 'Tumour',
            specimenType: 'Primary tumour',
            samples: [
              {
                sampleId: 412617,
                submitterId: 'PCSI_0127_Pa_P',
                sampleType: 'Total DNA',
              },
            ],
            specimenTissueSource: 'Solid tissue',
          },
        ],
        submitterId: 'PCSI_0127',
      });
      chai.expect(sps.size).to.eq(38);

      fs.writeFileSync('/tmp/icgc-donors.json', JSON.stringify(response.body));
      const donorsFile = (file = fs.readFileSync('/tmp/icgc-donors.json'));
      const importResponse = await chai
        .request(app)
        .post('/submission/icgc-import/')
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .type('form')
        .attach('donors', donorsFile, `donors.json`)
        .then(res => {
          return res;
        });

      importResponse.should.have.status(201);
      return;
    });
  });

  describe('clinical-submission: upload', function() {
    this.beforeEach(async () => await clearCollections(dburl, ['donors', 'activesubmissions']));
    it('should return 200 and empty json for no activesubmisison in program', done => {
      chai
        .request(app)
        .get('/submission/program/ABCD-EF/clinical/')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(200);
          res.body.should.deep.eq({});
          done();
        });
    });

    it('should return 422 if try to upload invalid tsv files', done => {
      const files: Buffer[] = [];
      try {
        files.push(fs.readFileSync(stubFilesDir + '/donor.invalid.tsv'));
        files.push(fs.readFileSync(stubFilesDir + '/radiation.invalid.tsv'));
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        // data base is empty so ID shouldn't exist
        .post('/submission/program/ABCD-EF/clinical/upload')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .attach('clinicalFiles', files[0], 'donor.invalid.tsv')
        .attach('clinicalFiles', files[1], 'radiation.invalid.tsv')
        .end((err: any, res: any) => {
          res.should.have.status(207);
          res.body.submission.clinicalEntities.donor.schemaErrors.should.deep.eq(
            expectedDonorBatchSubmissionSchemaErrors,
          );
          res.body.submission.clinicalEntities.radiation.schemaErrors.should.deep.eq(
            expectedRadiationBatchSubmissionSchemaErrors,
          );
          res.body.successful.should.deep.eq(false);
          done();
        });
    });
    it('should return 200 if try to upload valid tsv files', done => {
      let file: Buffer;
      try {
        file = fs.readFileSync(stubFilesDir + '/donor.tsv');
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        // data base is empty so ID shouldn't exist
        .post('/submission/program/ABCD-EF/clinical/upload')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .attach('clinicalFiles', file, 'donor.tsv')
        .end(async (err: any, res: any) => {
          res.should.have.status(200);
          res.body.successful.should.deep.eq(true);
          const conn = await mongo.connect(dburl);
          const savedSubmission: ActiveClinicalSubmission | null = await conn
            .db('clinical')
            .collection('activesubmissions')
            .findOne({});
          await conn.close();
          if (!savedSubmission) {
            throw new Error("saved submission shouldn't be null");
          }
          return done();
        });
    });
    it('should return appropriate file errors for clinical upload', done => {
      const files: Buffer[] = [];
      try {
        files.push(fs.readFileSync(stubFilesDir + '/donor.tsv'));
        files.push(fs.readFileSync(stubFilesDir + '/thisissample.tsv'));
        files.push(fs.readFileSync(stubFilesDir + '/donor.invalid.tsv'));
        files.push(fs.readFileSync(stubFilesDir + '/specimen-invalid-headers.tsv'));
        files.push(fs.readFileSync(stubFilesDir + '/sample_registration.tsv'));
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        // data base is empty so ID shouldn't exist
        .post('/submission/program/ABCD-EF/clinical/upload')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .attach('clinicalFiles', files[0], 'donor.tsv')
        .attach('clinicalFiles', files[1], 'thisissample.tsv')
        .attach('clinicalFiles', files[2], 'donor.invalid.tsv')
        .attach('clinicalFiles', files[3], 'specimen-invalid-headers.tsv')
        .attach('clinicalFiles', files[4], 'sample_registration.tsv')
        .end((err: any, res: any) => {
          res.should.have.status(207);
          res.body.batchErrors.should.deep.equalInAnyOrder([
            {
              message: 'Found multiple files of donor type',
              batchNames: ['donor.tsv', 'donor.invalid.tsv'],
              code: 'MULTIPLE_TYPED_FILES',
            },
            {
              message: INVALID_FILENAME_ERROR,
              batchNames: ['thisissample.tsv'],
              code: 'INVALID_FILE_NAME',
            },
            {
              message: `Missing required headers: [${SampleRegistrationFieldsEnum.submitter_donor_id}], [${SampleRegistrationFieldsEnum.submitter_specimen_id}]`,
              batchNames: ['specimen-invalid-headers.tsv'],
              code: SubmissionBatchErrorTypes.MISSING_REQUIRED_HEADER,
            },
            {
              message: 'Found unknown headers: [submitter_id], [submitter_specmen_id]',
              batchNames: ['specimen-invalid-headers.tsv'],
              code: SubmissionBatchErrorTypes.UNRECOGNIZED_HEADER,
            },
            {
              message: 'Please upload this file in the Register Samples section.',
              batchNames: ['sample_registration.tsv'],
              code: SubmissionBatchErrorTypes.INCORRECT_SECTION,
            },
          ]);
          done();
        });
    });
    it('should clear active submission if there are upload errors that cause clinicalEntities to be empty', async () => {
      const SUBMISSION = {
        state: SUBMISSION_STATE.VALID,
        programId: 'ABCD-EF',
        version: 'asdf',
        clinicalEntities: { donor: [{ submitterId: 123 }] },
      };

      await insertData(dburl, 'activesubmissions', SUBMISSION);
      const files: Buffer[] = [];
      try {
        files.push(fs.readFileSync(stubFilesDir + '/donor.invalid.tsv'));
      } catch (err) {}
      await chai
        .request(app)
        // data base is empty so ID shouldn't exist
        .post('/submission/program/ABCD-EF/clinical/upload')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .attach('clinicalFiles', files[0], 'donor.invalid.tsv');

      const dbRead = await findInDb(dburl, 'activesubmissions', {
        programId: 'ABCD-EF',
      });
      chai
        .expect(dbRead.length, 'There should be no active submission for this program')
        .to.equal(0);
    });
  });

  describe('clinical-submission: validate', function() {
    it('should return invalid and data errors for validation request of invalid submission', done => {
      let file: Buffer;
      try {
        file = fs.readFileSync(stubFilesDir + '/donor.tsv');
      } catch (err) {
        return err;
      }
      chai
        .request(app)
        .post('/submission/program/ABCD-EF/clinical/upload')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .attach('clinicalFiles', file, 'donor.tsv')
        .end((err: any, res: any) => {
          try {
            res.body.submission.state.should.eq(SUBMISSION_STATE.OPEN);
            chai
              .request(app)
              .post('/submission/program/ABCD-EF/clinical/validate/' + res.body.submission.version)
              .auth(JWT_ABCDEF, { type: 'bearer' })
              .end((err: any, res: any) => {
                try {
                  res.body.submission.state.should.eq(SUBMISSION_STATE.INVALID);
                  res.body.submission.clinicalEntities.donor.stats.errorsFound.should.deep.eq([0]);
                  res.body.submission.clinicalEntities.donor.dataErrors.should.deep.eq([
                    {
                      type: DataValidationErrors.ID_NOT_REGISTERED,
                      fieldName: SampleRegistrationFieldsEnum.submitter_donor_id,
                      info: {
                        donorSubmitterId: 'ICGC_0001',
                        value: 'ICGC_0001',
                      },
                      message:
                        'ICGC_0001 has not yet been registered. Please register samples before submitting clinical data for this identifier.',
                      index: 0,
                    },
                  ]);
                  return done();
                } catch (err) {
                  return done(err);
                }
              });
          } catch (err) {
            return done(err);
          }
        });
    });
    it('should return valid and no errors for validation request of valid submission', async () => {
      let file: Buffer;
      try {
        file = fs.readFileSync(stubFilesDir + '/donor.tsv');
      } catch (err) {
        return err;
      }
      // insert donor into db
      await createDonorDoc(
        dburl,
        emptyDonorDocument({
          submitterId: 'ICGC_0001',
          donorId: 1,
          gender: 'Male',
          specimens: [
            {
              specimenId: 1,
              clinicalInfo: {},
              specimenTissueSource: '',
              tumourNormalDesignation: 'Normal',
              submitterId: 'ssp1',
              specimenType: 'Normal',
              samples: [
                {
                  sampleType: 'totalDNA',
                  submitterId: 'ssa1',
                  sampleId: 1,
                },
              ],
            },
          ],
          clinicalInfo: {},
          programId: 'ABCD-EF',
        }),
      );

      return chai
        .request(app)
        .post('/submission/program/ABCD-EF/clinical/upload')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .attach('clinicalFiles', file, 'donor.tsv')
        .then(async (res: any) => {
          try {
            res.should.have.status(200);
            res.body.submission.state.should.eq(SUBMISSION_STATE.OPEN);
            const versionId = res.body.submission.version;
            return chai
              .request(app)
              .post('/submission/program/ABCD-EF/clinical/validate/' + versionId)
              .auth(JWT_ABCDEF, { type: 'bearer' })
              .then((res: any) => {
                try {
                  res.should.have.status(200);
                  res.body.submission.state.should.eq(SUBMISSION_STATE.VALID);
                  res.body.submission.clinicalEntities.donor.records.length.should.eq(1);
                  res.body.submission.clinicalEntities.donor.dataErrors.length.should.eq(0);
                } catch (err) {
                  throw err;
                }
              });
          } catch (err) {
            throw err;
          }
        });
    });
    it('should return with appropriate stats', async () => {
      const files: Buffer[] = [];
      try {
        files.push(fs.readFileSync(stubFilesDir + '/donor.tsv'));
        files.push(fs.readFileSync(stubFilesDir + '/specimen.tsv'));
        files.push(fs.readFileSync(stubFilesDir + '/primary_diagnosis.tsv'));
      } catch (err) {
        return err;
      }
      // insert donor into db
      await insertData(dburl, 'donors', {
        followUps: [],
        treatments: [],
        chemotherapy: [],
        hormoneTherapy: [],
        gender: 'Male',
        submitterId: 'ICGC_0001',
        programId: 'ABCD-EF',
        specimens: [
          {
            samples: [],
            specimenTissueSource: 'Other',
            tumourNormalDesignation: 'Tumour',
            submitterId: '8013861',
            clinicalInfo: {
              program_id: 'ABCD-EF',
              submitter_donor_id: 'ICGC_0001',
              submitter_specimen_id: '8013861',
              specimen_acquisition_interval: 200,
              specimen_anatomic_location: 'Other',
              central_pathology_confirmed: 'No',
              tumour_histological_type: 'M-1111/22',
              tumour_grading_system: 'Default',
              tumour_grade: 'aStringValue',
              pathological_tumour_staging_system: 'Murphy',
              pathological_stage_group: 'aStringValue',
              percent_proliferating_cells: 0.5,
              percent_inflammatory_tissue: 0.6,
              percent_stromal_cells: 0.65,
              percent_necrosis: 0.65,
              percent_tumour_cells: 0.5,
            },
          },
          {
            samples: [],
            specimenTissueSource: 'Other',
            tumourNormalDesignation: 'Tumour',
            submitterId: '8013862',
            clinicalInfo: {
              program_id: 'ABCD-EF',
              submitter_donor_id: 'ICGC_0001',
              submitter_specimen_id: '8013862',
              specimen_acquisition_interval: 230,
              specimen_anatomic_location: 'Other',
              central_pathology_confirmed: 'No',
              tumour_histological_type: 'M-1111/22',
              tumour_grading_system: 'Default',
              tumour_grade: 'aStringValue',
              pathological_tumour_staging_system: 'Murphy',
              pathological_stage_group: 'aStringValue',
              percent_proliferating_cells: 0.3,
              percent_inflammatory_tissue: 0.2,
              percent_stromal_cells: 0.2,
              percent_necrosis: 0.3,
              percent_tumour_cells: 0.1,
            },
          },
        ],
        primaryDiagnosis: {
          clinicalInfo: {
            program_id: 'ABCD-EF',
            number_lymph_nodes_examined: 2,
            submitter_donor_id: 'ICGC_0001',
            age_at_diagnosis: 96,
            cancer_type_code: 'A11.1A',
            tumour_staging_system: 'Murphy',
            presenting_symptoms: null, // tslint:disable-line
          },
        },
        donorId: 1,
      });
      return chai
        .request(app)
        .post('/submission/program/ABCD-EF/clinical/upload')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .attach('clinicalFiles', files[0], 'donor.tsv')
        .attach('clinicalFiles', files[1], 'specimen.tsv')
        .attach('clinicalFiles', files[2], 'primary_diagnosis.tsv')
        .then(async (res: any) => {
          try {
            res.should.have.status(200);
            res.body.submission.state.should.eq(SUBMISSION_STATE.OPEN);
            const versionId = res.body.submission.version;
            return chai
              .request(app)
              .post('/submission/program/ABCD-EF/clinical/validate/' + versionId)
              .auth(JWT_ABCDEF, { type: 'bearer' })
              .then((res: any) => {
                try {
                  res.should.have.status(200);
                  res.body.submission.state.should.eq(SUBMISSION_STATE.VALID);
                  const clinicalEntities: ClinicalEntities = res.body.submission.clinicalEntities;
                  clinicalEntities.donor.stats.new.should.deep.eq([0]);
                  clinicalEntities.specimen.stats.updated.should.deep.eq([0]);
                  clinicalEntities.specimen.stats.noUpdate.should.deep.eq([1]);
                  clinicalEntities.specimen.dataUpdates.should.deep.eq([
                    {
                      fieldName: 'percent_tumour_cells',
                      index: 0,
                      info: {
                        donorSubmitterId: 'ICGC_0001',
                        newValue: '0.35',
                        oldValue: '0.5',
                      },
                    },
                  ]);
                  clinicalEntities.primary_diagnosis.stats.noUpdate.should.deep.eq([0]);
                } catch (err) {
                  throw err;
                }
              });
          } catch (err) {
            throw err;
          }
        });
    });
  });

  describe('clinical-submission: clear', function() {
    const programId = 'ABCD-EF';
    let donor: any;
    let submissionVersion: string;

    const uploadSubmission = async () => {
      let donorFile: Buffer;
      let specimenFile: Buffer;
      try {
        donorFile = fs.readFileSync(stubFilesDir + '/donor.tsv');
        specimenFile = fs.readFileSync(stubFilesDir + '/specimen.tsv');
      } catch (err) {
        return err;
      }

      await chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/upload`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .attach('clinicalFiles', donorFile, 'donor.tsv')
        .attach('clinicalFiles', specimenFile, 'specimen.tsv')
        .then((res: any) => {
          submissionVersion = res.body.submission.version;
        })
        .catch(err => chai.assert.fail(err));
    };

    this.beforeEach(async () => {
      await clearCollections(dburl, ['donors', 'activesubmissions']);
      donor = await generateDonor(dburl, programId, 'ICGC_0001');
    });
    it('should return 401 if no auth is provided', done => {
      chai
        .request(app)
        .delete('/submission/program/ABCD-EF/clinical/asdf/asdf')
        .end((err: any, res: any) => {
          res.should.have.status(401);
          done();
        });
    });
    it('should return 403 if the user is not an admin for that program', done => {
      chai
        .request(app)
        .delete('/submission/program/ABCD-EF/clinical/asdf/asdf')
        .auth(JWT_WXYZEF, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(403);
          done();
        });
    });
    it('should return 404 if no active submission is available', done => {
      chai
        .request(app)
        .delete('/submission/program/WRONG-ID/clinical/asdf/asdf')
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(404);
          done();
        });
    });
    it('should return 400 if an active submission is available with a different version ID', async () => {
      await uploadSubmission();
      return chai
        .request(app)
        .delete(`/submission/program/${programId}/clinical/wrong-version-id/asdf`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then((res: any) => {
          res.should.have.status(400);
        });
    });
    it('should return 409 if an active submission is available but in PENDING_APPROVAL state', async () => {
      const SUBMISSION_PENDING_APPROVAL = {
        state: SUBMISSION_STATE.PENDING_APPROVAL,
        programId: 'ABCD-EF',
        version: 'asdf',
        clinicalEntities: { donor: [{ submitterId: 123 }] },
      };

      await insertData(dburl, 'activesubmissions', SUBMISSION_PENDING_APPROVAL);
      return chai
        .request(app)
        .delete(`/submission/program/ABCD-EF/clinical/asdf/donor`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then((res: any) => {
          res.should.have.status(409);
        });
    });
    it('should return 200 when clear all is completed, and have no active submission for this program in the DB', async () => {
      await uploadSubmission();
      return chai
        .request(app)
        .delete(`/submission/program/${programId}/clinical/${submissionVersion}/all`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then(async (res: any) => {
          res.should.have.status(200);
          chai.expect(res.text, 'Response should be empty object').to.equal('{}');
          chai.expect(res.type, 'Response should be json type').to.equal('application/json');

          const dbRead = await findInDb(dburl, 'activesubmissions', {
            programId: 'ABCD-EF',
          });
          chai
            .expect(dbRead.length, 'There should be no active submission for this program')
            .to.equal(0);
        });
    });

    it('should return 200 when clear donor is completed, have specimen in clinicalEntities but no donor', async () => {
      await uploadSubmission();
      return chai
        .request(app)
        .delete(`/submission/program/${programId}/clinical/${submissionVersion}/donor`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then(async (res: any) => {
          res.should.have.status(200);
          chai.expect(res.body.clinicalEntities.donor).to.be.undefined;
          chai.expect(res.body.clinicalEntities.specimen).to.exist;

          const dbRead = await findInDb(dburl, 'activesubmissions', {
            programId: 'ABCD-EF',
          });
          chai.expect(dbRead[0].clinicalEntities.donor).to.be.undefined;
          chai.expect(dbRead[0].clinicalEntities.specimen).to.exist;
        });
    });
    it('should clear active submission record if all data is cleared', async () => {
      const SUBMISSION = {
        state: SUBMISSION_STATE.VALID,
        programId: 'ABCD-EF',
        version: 'asdf',
        clinicalEntities: { donor: [{ submitterId: 123 }] },
      };

      await insertData(dburl, 'activesubmissions', SUBMISSION);
      return chai
        .request(app)
        .delete(`/submission/program/ABCD-EF/clinical/asdf/donor`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then(async (res: any) => {
          res.should.have.status(200);
          chai.expect(res.text, 'Response should be empty object').to.equal('{}');
          chai.expect(res.type, 'Response should be json type').to.equal('application/json');

          const dbRead = await findInDb(dburl, 'activesubmissions', {
            programId: 'ABCD-EF',
          });
          chai.expect(dbRead.length).to.equal(0);
        });
    });
  });

  describe('clinical-submission: commit', function() {
    const programId = 'ABCD-EF';
    let donor: any;
    let submissionVersion: string;
    this.beforeEach(async () => {
      await clearCollections(dburl, ['donors', 'activesubmissions']);
      donor = await generateDonor(dburl, programId, 'ICGC_0001');
    });

    const uploadSubmission = async (fileName: string = 'donor.tsv') => {
      let file: Buffer;
      try {
        file = fs.readFileSync(stubFilesDir + `/${fileName}`);
      } catch (err) {
        return err;
      }

      return chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/upload`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .attach('clinicalFiles', file, 'donor.tsv')
        .then((res: any) => {
          submissionVersion = res.body.submission.version;
        })
        .catch(err => chai.assert.fail(err));
    };
    const validateSubmission = async () => {
      return chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/validate/${submissionVersion}`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then((res: any) => {
          submissionVersion = res.body.submission.version;
        })
        .catch(err => chai.assert.fail(err));
    };

    it('should return 401 if no auth is provided', done => {
      chai
        .request(app)
        .post('/submission/program/ABCD-EF/clinical/commit/asdf')
        .end((err: any, res: any) => {
          res.should.have.status(401);
          done();
        });
    });
    it('should return 403 if the user is not an admin for that program', done => {
      chai
        .request(app)
        .post('/submission/program/ABCD-EF/clinical/commit/asdf')
        .auth(JWT_WXYZEF, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(403);
          done();
        });
    });
    it('should return 404 if no active submission is available', done => {
      chai
        .request(app)
        .post('/submission/program/WRONG-ID/clinical/commit/asdf')
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(404);
          done();
        });
    });
    it('should return 400 if an active submission is available with a different version ID', async () => {
      await uploadSubmission();
      return chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/commit/wrong-version-id`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then((res: any) => {
          res.should.have.status(400);
        });
    });
    it('should return 409 if an active submission is available but not in VALID state', async () => {
      await uploadSubmission();
      return chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/commit/${submissionVersion}`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then((res: any) => {
          res.should.have.status(409);
        });
    });
    it('should return 200 when commit is completed', async () => {
      await uploadSubmission();
      await validateSubmission();
      return chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/commit/${submissionVersion}`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then(async (res: any) => {
          res.should.have.status(200);
          res.body.should.eql({});
          // check activesubmission removed
          await assertDbCollectionEmpty(dburl, 'activesubmissions');

          // check donor merge
          const [updatedDonor] = await findInDb(dburl, 'donors', {
            programId: programId,
            submitterId: 'ICGC_0001',
          });
          // merge shouldn't have mutated donor except for donor.clinicalInfo
          chai
            .expect(updatedDonor)
            .excluding(['clinicalInfo', 'updatedAt', '__v', 'createdAt', 'completionStats'])
            .to.deep.eq(donor);
          chai.expect(updatedDonor.clinicalInfo).to.exist;
          chai.expect(updatedDonor.clinicalInfo).to.deep.include({
            [DonorFieldsEnum.vital_status]: 'Deceased',
            [DonorFieldsEnum.survival_time]: 522,
          });
        });
    });
  });

  describe('clinical-submission: approve', function() {
    const programId = 'ABCD-EF';
    let donor: any;
    let submissionVersion: string;

    const uploadSubmission = async (fileNames: string[] = ['donor.tsv']) => {
      const files: Buffer[] = [];
      let req = chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/upload`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' });

      fileNames.forEach(fn => {
        try {
          const file = fs.readFileSync(stubFilesDir + `/${fn}`);
          req = req.attach('clinicalFiles', file, fn);
        } catch (err) {
          return err;
        }
      });

      return req.then((res: any) => {
        res.body.successful.should.be.true;
        submissionVersion = res.body.submission.version;
      });
    };

    const uploadSubmissionWithUpdates = async (
      fileNames: string[] = ['donor-with-updates.tsv'],
    ) => {
      return await uploadSubmission(fileNames);
    };

    const validateSubmission = async () => {
      return await chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/validate/${submissionVersion}`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then((res: any) => {
          submissionVersion = res.body.submission.version;
        });
    };

    const commitActiveSubmission = async () => {
      return await chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/commit/${submissionVersion}`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then((res: any) => {
          submissionVersion = res.body.version;
        });
    };

    this.beforeEach(async () => {
      await clearCollections(dburl, ['donors', 'activesubmissions']);
      donor = await generateDonor(dburl, programId, 'ICGC_0001');
    });

    it('should return 401 if no auth is provided', done => {
      chai
        .request(app)
        .post('/submission/program/ABCD-EF/clinical/approve/asdf')
        .end((err: any, res: any) => {
          res.should.have.status(401);
          done();
        });
    });
    it('should return 403 if the user is not DCC Admin', done => {
      chai
        .request(app)
        .post('/submission/program/ABCD-EF/clinical/approve/asdf')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(403);
          done();
        });
    });
    it('should return 404 if no active submission is available', done => {
      chai
        .request(app)
        .post('/submission/program/WRONG-ID/clinical/approve/asdf')
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(404);
          done();
        });
    });
    it('should return 400 if an active submission is available with a different version ID', async () => {
      await uploadSubmission();
      return chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/approve/wrong-version-id`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then((res: any) => {
          res.should.have.status(400);
        });
    });
    it('should return 409 if an active submission is available but not in PENDING_APPROVAL state', async () => {
      await uploadSubmission();
      await validateSubmission();
      // State should be approved
      return chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/approve/${submissionVersion}`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then((res: any) => {
          res.should.have.status(409);
        });
    });
    it('should return 200 and PENDING_APPROVAL when commit has updates', async () => {
      await uploadSubmission();
      await validateSubmission();
      await commitActiveSubmission();
      // Now we need to have a submission with updates, and validate to get it into the correct state
      await uploadSubmissionWithUpdates();
      await validateSubmission();
      return chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/commit/${submissionVersion}`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then((res: any) => {
          res.should.have.status(200);
          res.body.state.should.eq(SUBMISSION_STATE.PENDING_APPROVAL);
          res.body.updatedBy.should.eq('Test User'); // the user who signed off into pending_approval
        });
    });

    it('should return 200 when commit is completed', async () => {
      // To get submission into correct state (pending approval) we need to already have a completed submission...
      await uploadSubmission([
        'donor.tsv',
        'primary_diagnosis.tsv',
        'follow_up.tsv',
        'treatment.tsv',
        'chemotherapy.tsv',
        'radiation.tsv',
        'hormone_therapy.tsv',
      ]);
      await validateSubmission();
      await commitActiveSubmission();
      const [DonorBeforeUpdate] = await findInDb(dburl, 'donors', {
        programId: programId,
        submitterId: 'ICGC_0001',
      });

      const entityBase = { program_id: programId, submitter_donor_id: 'ICGC_0001' };

      const primary_diagnosis = {
        ...entityBase,
        number_lymph_nodes_examined: 2,
        age_at_diagnosis: 96,
        cancer_type_code: 'A11.1A',
        tumour_staging_system: 'Murphy',
        presenting_symptoms: null, // tslint:disable-line
      };

      const donor = {
        ...entityBase,
        vital_status: 'Deceased',
        cause_of_death: 'Died of cancer',
        survival_time: 522,
      };

      DonorBeforeUpdate.primaryDiagnosis.clinicalInfo.should.deep.eq(primary_diagnosis);
      DonorBeforeUpdate.clinicalInfo.should.deep.eq(donor);

      // Now we need to have a submission with updates, and validate to get it into the correct state
      await uploadSubmissionWithUpdates([
        'donor-with-updates.tsv',
        'follow_up_update.tsv',
        'treatment_update.tsv',
        'chemotherapy_update.tsv',
        'radiation_update.tsv',
        'hormone_therapy_update.tsv',
      ]);
      await validateSubmission();
      await commitActiveSubmission();

      const [donorBeforeApproveCommit] = await findInDb(dburl, 'donors', {
        programId: programId,
        submitterId: 'ICGC_0001',
      });

      // data from primary_diagnosis.tsv
      donorBeforeApproveCommit.primaryDiagnosis.clinicalInfo.should.deep.eq(primary_diagnosis);

      DonorBeforeUpdate.clinicalInfo.should.include(donor);

      return chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/approve/${submissionVersion}`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then(async (res: any) => {
          res.should.have.status(200);
          res.body.should.be.empty;
          await assertDbCollectionEmpty(dburl, 'activesubmissions');
          const [updatedDonor] = await findInDb(dburl, 'donors', {
            programId: programId,
            submitterId: 'ICGC_0001',
          });

          // ** merge shouldn't have mutated clinical entities except for the ones being updated **
          const donorBeforeUpdates = _.omit(donorBeforeApproveCommit, [
            '__v', // ignore mongodb field
            'updatedAt', // ignore mongodb field
            'clinicalInfo', // donor clinicalInfo is being updated
            'clinicalInfoStats', // donor clinicalInfoStats are being updated
            'treatments', // the treatments are being updated
            'followUps[0]', // this followUp is being updated
            'aggregatedInfoStats', // aggregatedInfoStats are being updated
          ]);
          // these are set becuase they were updated and can be ignored in this chai.expect assert
          donorBeforeUpdates.followUps[0] = updatedDonor.followUps[0];
          donorBeforeUpdates.treatments = updatedDonor.treatments;
          // check nothing else in updatedDonor has changed from before update
          chai.expect(updatedDonor).to.deep.include(donorBeforeUpdates);

          // ** check donor clinicalInfo updates **
          const updatedDonorExpectedInfo = {
            program_id: programId,
            submitter_donor_id: 'ICGC_0001',
            cause_of_death: null, // tslint:disable-line
            survival_time: null, // tslint:disable-line
            vital_status: 'Alive',
          };
          chai.expect(updatedDonor.clinicalInfo).to.deep.eq(updatedDonorExpectedInfo);

          // ** check followUps clinicalInfo updates **
          updatedDonor.followUps[0].clinicalInfo['interval_of_followup'].should.eq(13);
          donorBeforeApproveCommit.followUps[0].clinicalInfo.should.deep.include(
            _.omit(updatedDonor.followUps[0].clinicalInfo, ['interval_of_followup']),
          );

          // ** check treatment & therapy clinicalInfo updates **
          updatedDonor.treatments[0].clinicalInfo['therapeutic_intent'].should.eq('Curative');
          // chemotherapy therapy
          updatedDonor.treatments[0].therapies[0].clinicalInfo['cumulative_drug_dosage'].should.eq(
            15,
          );
          // radiation therapy
          updatedDonor.treatments[0].therapies[1].clinicalInfo[
            'radiation_therapy_dosage'
          ].should.eq(90);
          // hormone therapy
          updatedDonor.treatments[1].therapies[0].clinicalInfo['cumulative_drug_dosage'].should.eq(
            44,
          );
        });
    });

    it('should return 200 when commit is completed - clinical stats', async () => {
      const donorFilter = { programId: programId, submitterId: 'ICGC_0001' };
      // To get submission into correct state (pending approval) we need to already have a completed submission...
      await uploadSubmission([
        'donor.tsv',
        'primary_diagnosis.tsv',
        'treatment.tsv',
        'chemotherapy.tsv',
        'radiation.tsv',
        'hormone_therapy.tsv',
      ]);
      await validateSubmission();
      await commitActiveSubmission();
      const [DonorBeforeUpdate] = await findInDb(dburl, 'donors', donorFilter);
      DonorBeforeUpdate.completionStats.coreCompletion.should.deep.include({
        donor: 1,
        primaryDiagnosis: 1,
        treatments: 1,
        followUps: 0,
        specimens: 0,
      });

      // Imagine donor adds specimens via registration
      DonorBeforeUpdate.specimens = [
        {
          samples: [{ sampleType: 'ctDNA', submitterId: 'sm123-00-1' }],
          specimenTissueSource: 'Other',
          tumourNormalDesignation: 'Normal',
          specimenType: 'Normal',
          submitterId: 'ss123-sjdm-2',
          clinicalInfo: {},
        },
        {
          samples: [{ sampleType: 'ctDNA', submitterId: 'sm123-00-2' }],
          specimenTissueSource: 'Other',
          tumourNormalDesignation: 'Tumour',
          specimenType: 'Tumour',
          submitterId: 'ss123-sjdm-1',
          clinicalInfo: {},
        },
      ];

      await updateData(dburl, 'donors', DonorBeforeUpdate, donorFilter);

      await uploadSubmissionWithUpdates([
        'donor-with-updates.tsv',
        'follow_up.tsv',
        'specimen2.tsv', // added clinical info for tumour specimen ss123-sjdm-1
      ]);
      await validateSubmission();
      await commitActiveSubmission();
      return chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/approve/${submissionVersion}`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then(async (res: any) => {
          res.should.have.status(200);
          res.body.should.be.empty;
          await assertDbCollectionEmpty(dburl, 'activesubmissions');
          const [UpdatedDonor] = await findInDb(dburl, 'donors', donorFilter);
          UpdatedDonor.completionStats.coreCompletion.should.deep.include({
            donor: 1,
            primaryDiagnosis: 1,
            treatments: 1,
            followUps: 1,
            specimens: 0.5, // half of registered specimen's have records
          });
        });
    });

    it('TC-SMUIDAV should mark updated invalid donors as valid when they are approved', async () => {
      await createDonorDoc(
        dburl,
        emptyDonorDocument({
          submitterId: 'ICGC_0002',
          programId,
          schemaMetadata: {
            isValid: false,
            lastValidSchemaVersion: '0.1',
            originalSchemaVersion: '0.1',
          },
          clinicalInfo: {
            program_id: 'PACA-AU',
            submitter_donor_id: 'ICGC_0002',
            vital_status: 'InvalidOldValue',
            cause_of_death: 'Died of other reasons',
            survival_time: 540,
          },
        }),
      );
      await createDonorDoc(
        dburl,
        emptyDonorDocument({
          submitterId: 'ICGC_0003',
          programId,
          schemaMetadata: {
            isValid: false,
            lastValidSchemaVersion: '0.1',
            originalSchemaVersion: '0.1',
          },
          clinicalInfo: {
            program_id: programId,
            submitter_donor_id: 'ICGC_0003',
            vital_status: 'InvalidOldValue',
            cause_of_death: 'Died of cancer',
            survival_time: 23,
          },
          primaryDiagnosis: {
            clinicalInfo: {
              program_id: programId,
              number_lymph_nodes_positive: 1,
              submitter_donor_id: 'ICGC_0003',
              age_at_diagnosis: 96,
              cancer_type_code: 'A11.1A',
              tumour_staging_system: 'Binet', // this will be updated to Murphy
            },
          },
        }),
      );
      await uploadSubmission(['donor_TC-SMUIDAV.tsv', 'primary_diagnosis_TC-SMUIDAV.tsv']);
      await validateSubmission();
      await commitActiveSubmission();

      return chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/approve/${submissionVersion}`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then(async (res: any) => {
          res.should.have.status(200);
          res.body.should.be.empty;

          // check activesubmission removed
          await assertDbCollectionEmpty(dburl, 'activesubmissions');

          // check donor merge
          const [updatedDonor]: Donor[] = await findInDb(dburl, 'donors', {
            programId: programId,
            submitterId: 'ICGC_0002',
          });

          const [updatedDonor2]: Donor[] = await findInDb(dburl, 'donors', {
            programId: programId,
            submitterId: 'ICGC_0003',
          });

          chai.expect(updatedDonor.schemaMetadata.isValid).to.be.true;
          chai.expect(updatedDonor2.schemaMetadata.isValid).to.be.false;
          chai.expect(updatedDonor.schemaMetadata.lastValidSchemaVersion).to.eq('1.0');
          chai.expect(updatedDonor2.schemaMetadata.lastValidSchemaVersion).to.eq('0.1');

          chai.expect(updatedDonor.clinicalInfo).to.deep.include({
            [DonorFieldsEnum.vital_status]: 'Deceased',
            [DonorFieldsEnum.survival_time]: 100,
          });

          // we expect the other invalid donor to be updated even that it remained invalid
          // due to not updating the invalid clinical file (donor.clinicalInfo)
          chai.expect(updatedDonor2.primaryDiagnosis).to.deep.include({
            clinicalInfo: {
              age_at_diagnosis: 96,
              cancer_type_code: 'A11.1A',
              number_lymph_nodes_examined: 2,
              program_id: 'ABCD-EF',
              submitter_donor_id: 'ICGC_0003',
              tumour_staging_system: 'Murphy',
            },
          });
        });
    });

    it('should recalculate donor aggregate stats if donor becomes valid', async () => {
      await clearCollections(dburl, ['donors']);
      const invalidDonor = emptyDonorDocument({
        submitterId: 'ICGC_0001',
        programId,
        schemaMetadata: {
          isValid: false, // assume this is a donor that became invalid after a migration
          lastValidSchemaVersion: '0.1',
          originalSchemaVersion: '0.1',
        },
        clinicalInfo: {
          program_id: 'ABCD-EF',
          vital_status: 'DoDa', // invalid with new schema
          cause_of_death: 'DaDo', // invalid with new schema
          submitter_donor_id: 'ICGC_0001',
          survival_time: 120,
        },
        specimens: [
          {
            samples: [{ sampleType: 'ctDNA', submitterId: 'sm123-00-1' }],
            specimenTissueSource: 'Other',
            tumourNormalDesignation: 'Normal',
            specimenType: 'Normal',
            submitterId: 'ss123-sjdm-2',
            clinicalInfo: {},
          },
          {
            samples: [{ sampleType: 'ctDNA', submitterId: 'sm123-00-2' }],
            specimenTissueSource: 'Other',
            tumourNormalDesignation: 'Tumour',
            specimenType: 'Tumour',
            submitterId: 'ss123-sjdm-1',
            clinicalInfo: {},
          },
        ],
        completionStats: {
          coreCompletion: {
            donor: 0,
            primaryDiagnosis: 0,
            treatments: 1, // overridden stat
            followUps: 0,
            specimens: 0,
          },
          overriddenCoreCompletion: ['treatments'],
        },
      });
      await insertData(dburl, 'donors', invalidDonor);

      await uploadSubmission(['donor.tsv', 'specimen2.tsv']);
      await validateSubmission();
      await commitActiveSubmission();
      return chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/approve/${submissionVersion}`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then(async (res: any) => {
          res.should.have.status(200);
          res.body.should.be.empty;
          await assertDbCollectionEmpty(dburl, 'activesubmissions');
          const [updatedDonor] = await findInDb(dburl, 'donors', {
            programId: programId,
            submitterId: 'ICGC_0001',
          });
          // donor was invalid but is now valid after submission, so stats should be updated
          updatedDonor.schemaMetadata.isValid.should.eq(true);
          updatedDonor.completionStats.coreCompletion.should.deep.include({
            donor: 1,
            primaryDiagnosis: 0,
            treatments: 1, // overridden field is same as before, despite no treatment record
            followUps: 0,
            specimens: 0.5, // one of the tumour/normal specimen has record
          });
          chai
            .expect(updatedDonor.completionStats.overriddenCoreCompletion)
            .to.deep.eq(['treatments']);
        });
    });
  });

  describe('clinical-submission: reopen', function() {
    const progarmId: string = 'ABCD-EF';
    const subVersion: string = 'a-ver-sion';
    this.beforeEach(async () => {
      await clearCollections(dburl, ['donors', 'activesubmissions']);
    });
    it('should return 403 if the user is not DCC Admin or in correct program', done => {
      chai
        .request(app)
        .post('/submission/program/XYZ/clinical/reopen/asdf')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(403);
          done();
        });
    });
    it('should error for non existing submissions', done => {
      chai
        .request(app)
        .post(`/submission/program/${progarmId}/clinical/reopen/${subVersion}`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then((res: any) => {
          res.should.have.status(404);
          done();
        });
    });
    it('should not allow reopening if not PENDING_APPROVAL', async () => {
      await insertData(dburl, 'activesubmissions', {
        state: 'OPEN',
        programId: progarmId,
        version: subVersion,
        clinicalEntities: {},
      });
      return chai
        .request(app)
        .post(`/submission/program/${progarmId}/clinical/reopen/${subVersion}`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then((res: any) => {
          res.should.have.status(409);
        });
    });
    it('should allow reopening submission that is PENDING_APPROVAL', async () => {
      await insertData(dburl, 'activesubmissions', {
        state: 'PENDING_APPROVAL',
        programId: progarmId,
        version: subVersion,
        clinicalEntities: {
          donor: {
            batchName: 'donor.tsv',
            creator: 'Test User',
            createdAt: new Date(),
            records: [
              {
                submitter_donor_id: 'ICGC_0001',
                ethnicity: 'black or african american',
                vital_status: 'Deceased',
              },
            ],
            dataErrors: [],
            dataUpdates: [{}],
            stats: {
              new: [],
              noUpdate: [],
              updated: [0],
              errorsFound: [],
            },
          },
        },
      });
      return chai
        .request(app)
        .post(`/submission/program/${progarmId}/clinical/reopen/${subVersion}`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .then((res: any) => {
          chai.expect(res.status).to.eql(200);
          chai.expect(res.body.state).to.eql(SUBMISSION_STATE.OPEN);
          chai.expect(res.body.clinicalEntities.donor.stats.updated).to.eql([]);
          chai.expect(res.body.clinicalEntities.donor.dataUpdates).to.eql([]);
        });
    });
  });

  describe('schema', function() {
    it('get template found', done => {
      const name = ClinicalEntitySchemaNames.REGISTRATION;
      console.log("Getting template for '" + name + "'...");
      chai
        .request(app)
        .get('/submission/schema/template/' + name)
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(200);
          res.text.should.equal(
            `${SampleRegistrationFieldsEnum.program_id}\t${SampleRegistrationFieldsEnum.submitter_donor_id}\t${SampleRegistrationFieldsEnum.gender}\t` +
              `${SampleRegistrationFieldsEnum.submitter_specimen_id}\t${SampleRegistrationFieldsEnum.specimen_tissue_source}\t` +
              `${SampleRegistrationFieldsEnum.tumour_normal_designation}\t${SampleRegistrationFieldsEnum.specimen_type}\t` +
              `${SampleRegistrationFieldsEnum.submitter_sample_id}\t${SampleRegistrationFieldsEnum.sample_type}\n`,
          );
          res.should.header('Content-type', 'text/tab-separated-values;' + ' charset=utf-8');
          done();
        });
    });

    it('get all templates zip', done => {
      let refZip: AdmZip;
      try {
        refZip = new AdmZip(stubFilesDir + '/all.zip');
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        .get('/submission/schema/template/all')
        .buffer()
        // parse: collects data and creates AdmZip object (made wth buffered data) in res.body
        .parse((res: any, callBack: any) => {
          const data: any[] = [];
          res.on('data', (chunk: any) => {
            data.push(chunk);
          });
          res.on('end', () => {
            callBack(undefined, new AdmZip(Buffer.concat(data)));
          });
        })
        .end((err: any, res: any) => {
          // array of file content (which are just the field headers for each clinical type)
          const downloadedFiles: string[] = res.body
            .getEntries()
            .map((fileEntry: any) => res.body.readAsText(fileEntry));

          const refFiles: string[] = refZip
            .getEntries()
            .map((fileEntry: any) => refZip.readAsText(fileEntry));

          console.log(`Ref data is: [${refFiles}]`);
          console.log(`Downloaded data is: [${downloadedFiles}]`);

          refFiles.forEach(file => {
            chai.expect(downloadedFiles).to.contain(file);
          });
          return done();
        });
    });

    it('get template not found', done => {
      const name = 'invalid';
      console.log("Getting template for '" + name + "'...");
      chai
        .request(app)
        .get('/submission/schema/template/' + name)
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(404);
          res.body.message.should.equal("no schema named '" + name + "' found");
          res.should.header('Content-type', 'application/json; charset=utf-8');
          done();
        });
    });

    it('get template not found', done => {
      const name = 'invalid';
      console.log("Getting template for '" + name + "'...");
      chai
        .request(app)
        .get('/submission/schema/template/' + name)
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(404);
          res.body.message.should.equal("no schema named '" + name + "' found");
          res.should.header('Content-type', 'application/json; charset=utf-8');
          done();
        });
    });
  });
});

async function assert2ndCommitNewSamplesDetected(res: any) {
  res.should.have.status(200);
  chai.expect(res.body).to.deep.eq({
    newSamples: ['sm123-00-1', 'sm123-129', 'sm128-1', 'sm200-1'],
  });
  const donorsFromDB = await donorDao.findByProgramId('ABCD-EF');
  const expectedDonor = comittedDonors2.find(d => d.submitterId == donorsFromDB[0].submitterId);
  assertSameDonorWithoutGeneratedIds(donorsFromDB[0] as Donor, expectedDonor as Donor);
}

async function asserCommitExistingSamplesOK(res: any) {
  res.should.have.status(200);
  chai.expect(res.body).to.deep.eq({
    newSamples: [],
  });
  const donorsFromDB = await donorDao.findByProgramId('ABCD-EF');

  const expectedDonor = comittedDonors2.find(d => d.submitterId == 'abcd-125');
  assertSameDonorWithoutGeneratedIds(
    donorsFromDB.find(d => d.submitterId == 'abcd-125') as Donor,
    expectedDonor as Donor,
  );
}

async function assertFirstCommitDonorsCreatedInDB(res: any, rows: any[], dburl: string) {
  res.should.have.status(200);
  const expectedDonors: any[] = [];
  rows.forEach((r, idx) => {
    expectedDonors.push(
      emptyDonorDocument({
        gender: r[SampleRegistrationFieldsEnum.gender],
        primaryDiagnosis: undefined,
        submitterId: r[SampleRegistrationFieldsEnum.submitter_donor_id],
        programId: r[SampleRegistrationFieldsEnum.program_id],
        specimens: [
          {
            clinicalInfo: {},
            submitterId: r[SampleRegistrationFieldsEnum.submitter_specimen_id],
            specimenTissueSource: r[SampleRegistrationFieldsEnum.specimen_tissue_source],
            tumourNormalDesignation: r[SampleRegistrationFieldsEnum.tumour_normal_designation],
            specimenType: r[SampleRegistrationFieldsEnum.specimen_type],
            samples: [
              {
                sampleType: r[SampleRegistrationFieldsEnum.sample_type],
                submitterId: r[SampleRegistrationFieldsEnum.submitter_sample_id],
              },
            ],
          },
        ],
      }),
    );
  });

  const conn = await mongo.connect(dburl);
  const actualDonors: any[] | null = await conn
    .db('clinical')
    .collection('donors')
    .find({})
    .sort('donorId', 1)
    .toArray();
  await conn.close();

  chai.expect(actualDonors.length).to.eq(4);
  // ids are not in sequence so we check that they are in range only.
  actualDonors.forEach(ad => {
    chai.expect(ad.donorId).to.be.gte(baseDonorId);
    const specimensIdInRangeCount = ad.specimens.filter(
      (sp: any) => sp.specimenId >= baseSpecimenId,
    ).length;
    chai.expect(specimensIdInRangeCount).to.eq(ad.specimens.length);
    ad.specimens.forEach((sp: any) => {
      const samplesWithIdInRangeCount = sp.samples.filter((sa: any) => sa.sampleId >= baseSampleId)
        .length;
      chai.expect(samplesWithIdInRangeCount).to.eq(sp.samples.length);
    });
  });

  expectedDonors.forEach((dr, i) => {
    dr = JSON.parse(JSON.stringify(dr)) as Donor;
    const actualDonor = actualDonors.find(d => d.submitterId == dr.submitterId);
    assertSameDonorWithoutGeneratedIds(actualDonor, dr);
  });

  if (!actualDonors) {
    throw new Error("saved registration shouldn't be null");
  }
}

function assertSameDonorWithoutGeneratedIds(actual: Donor, expected: Donor) {
  chai
    .expect(actual)
    .excludingEvery([
      'donorId',
      'clinicalInfo',
      'specimenId',
      'sampleId',
      '__v',
      '_id',
      'primaryDiagnosis',
      'updatedAt',
      'createdAt',
    ])
    .to.deep.eq(expected);
}

async function assertUploadOKRegistrationCreated(res: any, dburl: string) {
  res.should.have.status(201);
  const conn = await mongo.connect(dburl);
  const savedRegistration: ActiveRegistration | null = await conn
    .db('clinical')
    .collection('activeregistrations')
    .findOne({});
  await conn.close();
  if (!savedRegistration) {
    throw new Error("saved registration shouldn't be null");
  }
}

const comittedDonors2: Donor[] = [
  {
    schemaMetadata: {
      isValid: true,
      lastValidSchemaVersion: '1.0',
      originalSchemaVersion: '1.0',
    },
    followUps: [],
    treatments: [],
    gender: 'Male',
    submitterId: 'abcd-125',
    programId: 'ABCD-EF',
    specimens: [
      {
        samples: [
          {
            sampleType: 'polyA+ RNA',
            submitterId: 'sm123-4',
            sampleId: baseSampleId,
          },
        ],
        specimenTissueSource: 'Bone marrow',
        tumourNormalDesignation: 'Tumour',
        specimenType: 'Xenograft - derived from primary tumour',
        submitterId: 'ss123-jdjr-ak',
        specimenId: baseSpecimenId,
        clinicalInfo: {},
      },
    ],
    donorId: baseDonorId,
  },
  {
    schemaMetadata: {
      isValid: true,
      lastValidSchemaVersion: '1.0',
      originalSchemaVersion: '1.0',
    },
    followUps: [],
    treatments: [],
    gender: 'Female',
    submitterId: 'abcd-126',
    programId: 'ABCD-EF',
    specimens: [
      {
        samples: [
          {
            sampleType: 'Ribo-Zero RNA',
            submitterId: 'sm123-5',
            sampleId: baseSampleId + 1,
          },
        ],
        specimenTissueSource: 'Serum',
        tumourNormalDesignation: 'Tumour',
        specimenType: 'Xenograft - derived from primary tumour',
        submitterId: 'ss123-sjdm',
        specimenId: baseSpecimenId + 1,
        clinicalInfo: {},
      },
      {
        samples: [
          {
            sampleType: 'ctDNA',
            submitterId: 'sm123-00-1',
            sampleId: baseSampleId + 4,
          },
        ],
        specimenTissueSource: 'Other',
        tumourNormalDesignation: 'Normal',
        specimenType: 'Normal',
        submitterId: 'ss123-sjdm-2',
        specimenId: 5,
        clinicalInfo: {},
      },
    ],
    donorId: baseDonorId + 1,
  },
  {
    schemaMetadata: {
      isValid: true,
      lastValidSchemaVersion: '1.0',
      originalSchemaVersion: '1.0',
    },
    followUps: [],
    treatments: [],
    gender: 'Male',
    submitterId: 'abcd-127',
    programId: 'ABCD-EF',
    specimens: [
      {
        samples: [
          {
            sampleType: 'polyA+ RNA',
            submitterId: 'sm123-6',
            sampleId: baseSampleId + 2,
          },
        ],
        specimenTissueSource: 'Pleural effusion',
        tumourNormalDesignation: 'Tumour',
        specimenType: 'Primary tumour - adjacent to normal',
        submitterId: 'ss123-1123',
        specimenId: baseSpecimenId + 2,
        clinicalInfo: {},
      },
    ],
    donorId: baseDonorId + 2,
  },
  {
    schemaMetadata: {
      isValid: true,
      lastValidSchemaVersion: '1.0',
      originalSchemaVersion: '1.0',
    },
    followUps: [],
    treatments: [],
    gender: 'Female',
    submitterId: 'abcd-128',
    programId: 'ABCD-EF',
    specimens: [
      {
        samples: [
          {
            sampleType: 'ctDNA',
            submitterId: 'sm123-7',
            sampleId: baseSampleId + 3,
          },
        ],
        specimenTissueSource: 'Other',
        tumourNormalDesignation: 'Tumour',
        specimenType: 'Metastatic tumour',
        submitterId: 'ss123-abnc',
        specimenId: baseSpecimenId + 3,
        clinicalInfo: {},
      },
      {
        samples: [
          {
            sampleType: 'ctDNA',
            submitterId: 'sm128-1',
            sampleId: baseSampleId + 6,
          },
        ],
        specimenTissueSource: 'Other',
        tumourNormalDesignation: 'Tumour',
        specimenType: 'Metastatic tumour',
        submitterId: 'ss123-abnc0',
        specimenId: baseSpecimenId + 6,
        clinicalInfo: {},
      },
    ],
    donorId: baseDonorId + 3,
  },
  {
    schemaMetadata: {
      isValid: true,
      lastValidSchemaVersion: '1.0',
      originalSchemaVersion: '1.0',
    },
    followUps: [],
    treatments: [],
    _id: '5d534820ae008e4dcb205274',
    gender: 'Female',
    submitterId: 'abcd-129',
    programId: 'ABCD-EF',
    specimens: [
      {
        samples: [
          {
            sampleType: 'polyA+ RNA',
            submitterId: 'sm123-129',
            sampleId: baseSampleId + 5,
          },
        ],
        specimenTissueSource: 'Pleural effusion',
        tumourNormalDesignation: 'Tumour',
        specimenType: 'Metastatic tumour',
        submitterId: 'ss123-129',
        specimenId: baseSpecimenId + 5,
        clinicalInfo: {},
      },
    ],
    donorId: baseDonorId + 4,
  },
  {
    schemaMetadata: {
      isValid: true,
      lastValidSchemaVersion: '1.0',
      originalSchemaVersion: '1.0',
    },
    followUps: [],
    treatments: [],
    gender: 'Male',
    submitterId: 'abcd-200',
    programId: 'ABCD-EF',
    specimens: [
      {
        samples: [
          {
            sampleType: 'Amplified DNA',
            submitterId: 'sm200-1',
            sampleId: baseSampleId + 7,
          },
        ],
        specimenTissueSource: 'Blood derived',
        tumourNormalDesignation: 'Tumour',
        specimenType: 'Recurrent tumour',
        submitterId: 'ss200-1',
        specimenId: baseSpecimenId + 7,
        clinicalInfo: {},
      },
    ],
    donorId: baseDonorId + 5,
  },
];

const expectedErrors = [
  {
    batchNames: ['sample_registration.invalid.tsv'],
    code: 'MISSING_REQUIRED_HEADER',
    message: 'Missing required headers: [tumour_normal_designation], [specimen_type]',
  },
  {
    batchNames: ['sample_registration.invalid.tsv'],
    code: 'UNRECOGNIZED_HEADER',
    message: 'Found unknown headers: [tumor_normal_designation]',
  },
];

const expectedResponse1 = {
  registration: {
    programId: 'ABCD-EF',
    creator: 'Test User',
    stats: {
      alreadyRegistered: [],
      newDonorIds: [
        {
          submitterId: 'abcd123',
          rowNumbers: [0],
        },
      ],
      newSpecimenIds: [
        {
          submitterId: 'ss123',
          rowNumbers: [0],
        },
      ],
      newSampleIds: [
        {
          submitterId: 'sm123',
          rowNumbers: [0],
        },
      ],
    },
    records: [
      {
        [SampleRegistrationFieldsEnum.program_id]: 'ABCD-EF',
        [SampleRegistrationFieldsEnum.submitter_donor_id]: 'abcd123',
        [SampleRegistrationFieldsEnum.gender]: 'Male',
        [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'ss123',
        [SampleRegistrationFieldsEnum.specimen_tissue_source]: 'Other',
        [SampleRegistrationFieldsEnum.tumour_normal_designation]: 'Normal',
        [SampleRegistrationFieldsEnum.specimen_type]: 'Normal',
        [SampleRegistrationFieldsEnum.submitter_sample_id]: 'sm123',
        [SampleRegistrationFieldsEnum.sample_type]: 'ctDNA',
      },
    ],
    __v: 0,
  },
  errors: [],
  successful: true,
};
const ABCD_REGISTRATION_DOC: ActiveRegistration = {
  programId: 'ABCD-EF',
  creator: 'Test User',
  schemaVersion: '1.0',
  batchName: `${ClinicalEntitySchemaNames.REGISTRATION}.tsv`,
  stats: {
    newDonorIds: [
      {
        submitterId: 'abcd123',
        rowNumbers: [0],
      },
    ],
    newSpecimenIds: [
      {
        submitterId: 'ss123',
        rowNumbers: [0],
      },
    ],
    newSampleIds: [
      {
        submitterId: 'sm123',
        rowNumbers: [0],
      },
    ],
    alreadyRegistered: [],
  },
  records: [
    {
      [SampleRegistrationFieldsEnum.program_id]: 'ABCD-EF',
      [SampleRegistrationFieldsEnum.submitter_donor_id]: 'abcd123',
      [SampleRegistrationFieldsEnum.gender]: 'Male',
      [SampleRegistrationFieldsEnum.submitter_specimen_id]: 'ss123',
      [SampleRegistrationFieldsEnum.specimen_tissue_source]: 'Other',
      [SampleRegistrationFieldsEnum.tumour_normal_designation]: 'Normal',
      [SampleRegistrationFieldsEnum.specimen_type]: 'Normal',
      [SampleRegistrationFieldsEnum.submitter_sample_id]: 'sm123',
      [SampleRegistrationFieldsEnum.sample_type]: 'ctDNA',
    },
  ],
};
const expectedDonorBatchSubmissionSchemaErrors = [
  {
    index: 1,
    type: 'FOUND_IDENTICAL_IDS',
    info: {
      value: 'ICGC_0001',
      donorSubmitterId: 'ICGC_0001',
      useAllRecordValues: false,
      conflictingRows: [2],
      uniqueIdNames: [ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.DONOR]],
    },
    message:
      'You are trying to submit the same [submitter_donor_id] in multiple rows. [submitter_donor_id] can only be submitted once per file.',
    fieldName: DonorFieldsEnum.submitter_donor_id,
  },
  {
    index: 2,
    type: 'FOUND_IDENTICAL_IDS',
    info: {
      value: 'ICGC_0001',
      donorSubmitterId: 'ICGC_0001',
      useAllRecordValues: false,
      conflictingRows: [1],
      uniqueIdNames: [ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.DONOR]],
    },
    message:
      'You are trying to submit the same [submitter_donor_id] in multiple rows. [submitter_donor_id] can only be submitted once per file.',
    fieldName: DonorFieldsEnum.submitter_donor_id,
  },
  {
    index: 0,
    type: 'INVALID_FIELD_VALUE_TYPE',
    info: {
      value: 'acdc',
      donorSubmitterId: 'ICGC_0002',
    },
    message: 'The value is not permissible for this field.',
    fieldName: DonorFieldsEnum.survival_time,
  },
  {
    index: 0,
    type: 'INVALID_ENUM_VALUE',
    info: {
      value: 'undecided',
      donorSubmitterId: 'ICGC_0002',
    },
    message: 'The value is not permissible for this field.',
    fieldName: DonorFieldsEnum.vital_status,
  },
];
const expectedRadiationBatchSubmissionSchemaErrors = [
  {
    index: 0,
    type: 'FOUND_IDENTICAL_IDS',
    info: {
      value: 'ICGC_0001',
      donorSubmitterId: 'ICGC_0001',
      useAllRecordValues: false,
      conflictingRows: [1],
      uniqueIdNames: ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.RADIATION],
    },
    message:
      'You are trying to submit the same [submitter_donor_id, submitter_treatment_id, radiation_therapy_modality] in multiple rows. [submitter_donor_id, submitter_treatment_id, radiation_therapy_modality] can only be submitted once per file.',
    fieldName: DonorFieldsEnum.submitter_donor_id,
  },
  {
    index: 1,
    type: 'FOUND_IDENTICAL_IDS',
    info: {
      value: 'ICGC_0001',
      donorSubmitterId: 'ICGC_0001',
      useAllRecordValues: false,
      conflictingRows: [0],
      uniqueIdNames: ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.RADIATION],
    },
    message:
      'You are trying to submit the same [submitter_donor_id, submitter_treatment_id, radiation_therapy_modality] in multiple rows. [submitter_donor_id, submitter_treatment_id, radiation_therapy_modality] can only be submitted once per file.',
    fieldName: DonorFieldsEnum.submitter_donor_id,
  },
];

const INVALID_FILENAME_ERROR =
  'Improperly named files cannot be uploaded or validated. Please retain the template file name and only append characters to the end (e.g. donor<_optional_extension>.tsv).';

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
