// using import fails when running the test
// import * as chai from "chai";
import chai from 'chai';
import mongo from 'mongodb';
import fs from 'fs';
// needed for types
import 'chai-http';
import 'mocha';
import mongoose from 'mongoose';
import { GenericContainer } from 'testcontainers';
import app from '../../../src/app';
import * as bootstrap from '../../../src/bootstrap';
import { cleanCollection, insertData, emptyDonorDocument, resetCounters } from '../testutils';
import { TEST_PUB_KEY, JWT_ABCDEF, JWT_WXYZEF } from '../test.jwt';
import {
  ActiveRegistration,
  ActiveClinicalSubmission,
  FieldsEnum,
  SUBMISSION_STATE,
} from '../../../src/submission/submission-entities';
import { TsvUtils } from '../../../src/utils';
import { donorDao } from '../../../src/clinical/donor-repo';
import { Donor } from '../../../src/clinical/clinical-entities';
import { ErrorCodes } from '../../../src/submission/submission-api';
import * as manager from '../../../src/lectern-client/schema-manager';

chai.use(require('chai-http'));
chai.should();

const expectedErrors = [
  {
    index: 0,
    type: 'MISSING_REQUIRED_FIELD',
    info: {
      donorSubmitterId: 'abcd123',
      sampleSubmitterId: 'sam123',
      specimenSubmitterId: 'sp123',
    },
    fieldName: 'tumour_normal_designation',
  },
  {
    fieldName: FieldsEnum.submitter_specimen_id,
    index: 0,
    info: {
      donorSubmitterId: 'abcd123',
      sampleSubmitterId: 'sam123',
      specimenSubmitterId: 'sp123',
      value: 'sp123',
    },
    type: 'INVALID_BY_REGEX',
  },
  {
    fieldName: FieldsEnum.submitter_sample_id,
    index: 0,
    info: {
      donorSubmitterId: 'abcd123',
      sampleSubmitterId: 'sam123',
      specimenSubmitterId: 'sp123',
      value: 'sam123',
    },
    type: 'INVALID_BY_REGEX',
  },
  {
    fieldName: 'gender',
    index: 0,
    info: {
      donorSubmitterId: 'abcd123',
      sampleSubmitterId: 'sam123',
      specimenSubmitterId: 'sp123',
      value: 'male',
    },
    type: 'INVALID_ENUM_VALUE',
  },
  {
    fieldName: 'sample_type',
    index: 0,
    info: {
      donorSubmitterId: 'abcd123',
      sampleSubmitterId: 'sam123',
      specimenSubmitterId: 'sp123',
      value: 'RNA',
    },
    type: 'INVALID_ENUM_VALUE',
  },
  {
    fieldName: 'program_id',
    index: 0,
    info: {
      expectedProgram: 'ABCD-EF',
      donorSubmitterId: 'abcd123',
      sampleSubmitterId: 'sam123',
      specimenSubmitterId: 'sp123',
      value: 'PEXA-MX',
    },
    type: 'INVALID_PROGRAM_ID',
  },
];

const expectedResponse1 = {
  registration: {
    programId: 'ABCD-EF',
    creator: 'Test User',
    stats: {
      alreadyRegistered: {},
      newDonorIds: {
        abcd123: [0],
      },
      newSpecimenIds: {
        ss123: [0],
      },
      newSampleIds: {
        sm123: [0],
      },
    },
    records: [
      {
        program_id: 'ABCD-EF',
        submitter_donor_id: 'abcd123',
        gender: 'Male',
        submitter_specimen_id: 'ss123',
        specimen_type: 'FFPE',
        tumour_normal_designation: 'Normal',
        submitter_sample_id: 'sm123',
        sample_type: 'ctDNA',
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
  batchName: 'registration.tsv',
  stats: {
    newDonorIds: {
      abcd123: [0],
    },
    newSpecimenIds: {
      ss123: [0],
    },
    newSampleIds: {
      sm123: [0],
    },
    alreadyRegistered: {},
  },
  records: [
    {
      program_id: 'ABCD-EF',
      submitter_donor_id: 'abcd123',
      gender: 'Male',
      submitter_specimen_id: 'ss123',
      specimen_type: 'FFPE',
      tumour_normal_designation: 'Normal',
      submitter_sample_id: 'sm123',
      sample_type: 'ctDNA',
    },
  ],
};
const expectedDonorErrors = [
  {
    index: 0,
    type: 'INVALID_FIELD_VALUE_TYPE',
    info: {
      value: 'acdc',
      donorSubmitterId: 'ICGC_0002',
    },

    fieldName: 'survival_time',
  },
  {
    index: 0,
    type: 'INVALID_ENUM_VALUE',
    info: {
      value: 'mail',
      donorSubmitterId: 'ICGC_0002',
    },
    fieldName: 'gender',
  },
  {
    index: 0,
    type: 'INVALID_ENUM_VALUE',
    info: {
      value: 'martian',
      donorSubmitterId: 'ICGC_0002',
    },
    fieldName: 'ethnicity',
  },
  {
    index: 0,
    type: 'INVALID_ENUM_VALUE',
    info: {
      value: 'undecided',
      donorSubmitterId: 'ICGC_0002',
    },
    fieldName: 'vital_status',
  },
  {
    type: 'INVALID_PROGRAM_ID',
    fieldName: 'program_id',
    index: 0,
    info: {
      value: 'PACA-AU',
      donorSubmitterId: 'ICGC_0002',
      expectedProgram: 'ABCD-EF',
    },
  },
];

const schemaServiceUrl = 'file://' + __dirname + '/stub-schema.json';

describe('Submission Api', () => {
  let mongoContainer: any;
  let dburl = ``;
  // will run when all tests are finished
  before(() => {
    return (async () => {
      manager.create(schemaServiceUrl);
      manager.instance().loadSchema('ARGO Clinical Submission', '1.0');
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
            return '1.0';
          },
          schemaName() {
            return 'ARGO Dictionary';
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

  describe('registration', function() {
    this.beforeEach(async () => {
      try {
        console.log(`registration beforeEach called ${dburl}`);
        await cleanCollection(dburl, 'donors');
        await cleanCollection(dburl, 'activeregistrations');
        await resetCounters(dburl);
        return;
      } catch (err) {
        console.error(err);
        return err;
      }
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
        file = fs.readFileSync(__dirname + '/registration.tsv');
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        // passing token with different program
        .auth(JWT_WXYZEF, { type: 'bearer' })
        .type('form')
        .attach('registrationFile', file, 'registration.tsv')
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
        file = fs.readFileSync(__dirname + '/registration.1.tsv');
        (async () =>
          (rows = (await TsvUtils.tsvToJson(__dirname + '/registration.1.tsv')) as any[]))();
      } catch (err) {
        return done(err);
      }

      try {
        file2 = fs.readFileSync(__dirname + '/registration.2.tsv');
      } catch (err) {
        return done(err);
      }

      chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .type('form')
        .attach('registrationFile', file, 'registration.1.tsv')
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
                    .attach('registrationFile', file2, 'registration.2.tsv')
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

    it('should commit registration, detect already registered', done => {
      let file: Buffer;
      let rows: any[];
      try {
        file = fs.readFileSync(__dirname + '/registration.1.tsv');
        (async () =>
          (rows = (await TsvUtils.tsvToJson(__dirname + '/registration.1.tsv')) as any[]))();
      } catch (err) {
        return done(err);
      }

      chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .type('form')
        .attach('registrationFile', file, 'registration.1.tsv')
        .end(async (err: any, res: any) => {
          try {
            await assertUploadOKRegistrationCreated(res, dburl);
            chai.expect(res.body.registration.stats.newSampleIds).to.deep.eq({
              'sm123-4': [0],
              'sm123-5': [1],
              'sm123-6': [2],
              'sm123-7': [3],
            });
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
                    .attach('registrationFile', file, 'registration.1.tsv')
                    .end(async (err: any, res: any) => {
                      try {
                        await assertUploadOKRegistrationCreated(res, dburl);
                        const reg2Id = res.body.registration._id;
                        chai.expect(reg2Id).to.not.eq(reg1Id);
                        chai.expect(res.body.registration.stats.newSampleIds).to.deep.eq({});
                        chai
                          .request(app)
                          .post(`/submission/program/ABCD-EF/registration/${reg2Id}/commit`)
                          .auth(JWT_ABCDEF, { type: 'bearer' })
                          .end(async (err: any, res: any) => {
                            try {
                              await asserCommitExistingSamplesOK(res);
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

    it('should accept valid registration tsv', done => {
      let file: Buffer;
      try {
        file = fs.readFileSync(__dirname + '/registration.tsv');
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .type('form')
        .attach('registrationFile', file, 'registration.tsv')
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
        file = fs.readFileSync(__dirname + '/registration.invalid.tsv');
      } catch (err) {
        throw err;
      }
      chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        .type('form')
        .attach('registrationFile', file, 'registration.invalid.tsv')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end(async (err: any, res: any) => {
          try {
            res.should.have.status(422);
            res.body.should.deep.eq({
              errors: expectedErrors,
              successful: false,
            });
            await assertDbCollectionEmpty(dburl, 'activeregistration');
          } catch (err) {
            throw err;
          }
        });
    });

    it('should not accept invalid file names', done => {
      let file: Buffer;
      try {
        file = fs.readFileSync(__dirname + '/thisIsARegistration.tsv');
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        .type('form')
        .attach('registrationFile', file, 'thisIsARegistration.tsv')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end(async (err: any, res: any) => {
          try {
            res.should.have.status(400);
            res.body.should.deep.eq({
              msg: 'invalid file name, must start with registration and have .tsv extension',
              code: ErrorCodes.INVALID_FILE_NAME,
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
      return chai
        .request(app)
        .delete('/submission/program/ABCD-EF/registration/' + registrationId)
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .then(async (res: any) => {
          try {
            res.should.have.status(200);
            await assertDbCollectionEmpty(dburl, 'activeregistration');
          } catch (err) {
            throw err;
          }
        });
    });
  });

  describe('clinical-submission', function() {
    this.beforeEach(async () => {
      try {
        console.log(`registration beforeEach called ${dburl}`);
        await cleanCollection(dburl, 'donors');
        await cleanCollection(dburl, 'activesubmissions');
        await resetCounters(dburl);
        return;
      } catch (err) {
        console.error(err);
        return err;
      }
    });
    it('should return 200 and empty json for no activesubmisison in program', done => {
      chai
        .request(app)
        .get('/submission/program/ABCD-EF/clinical/upload')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(200);
          res.body.should.deep.eq({});
          done();
        });
    });
    it('should return 422 if try to upload invalid tsv files', done => {
      let file: Buffer;
      let file2: Buffer;
      try {
        file = fs.readFileSync(__dirname + '/donor.invalid.tsv');
        file2 = fs.readFileSync(__dirname + '/sample.tsv');
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        // data base is empty so ID shouldn't exist
        .post('/submission/program/ABCD-EF/clinical/upload')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .attach('clinicalFiles', file, 'donor.invalid.tsv')
        .attach('clinicalFiles', file2, 'sample.tsv')
        .end((err: any, res: any) => {
          res.should.have.status(422);
          res.body.errors.should.deep.eq({ donor: expectedDonorErrors });
          res.body.successful.should.deep.eq(false);
          done();
        });
    });
    it('should return 200 if try to upload valid tsv files', done => {
      let file: Buffer;
      let file2: Buffer;
      try {
        file = fs.readFileSync(__dirname + '/donor.tsv');
        file2 = fs.readFileSync(__dirname + '/sample.tsv');
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        // data base is empty so ID shouldn't exist
        .post('/submission/program/ABCD-EF/clinical/upload')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .attach('clinicalFiles', file, 'donor.tsv')
        .attach('clinicalFiles', file2, 'sample.tsv')
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
    it('should return appropriate schema errors for clinical upload', done => {
      const files: Buffer[] = [];
      try {
        files.push(fs.readFileSync(__dirname + '/donor.tsv'));
        files.push(fs.readFileSync(__dirname + '/sample.tsv'));
        files.push(fs.readFileSync(__dirname + '/donor.invalid.tsv'));
        files.push(fs.readFileSync(__dirname + '/thisissample.tsv'));
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        // data base is empty so ID shouldn't exist
        .post('/submission/program/ABCD-EF/clinical/upload')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .attach('clinicalFiles', files[0], 'donor.tsv')
        .attach('clinicalFiles', files[1], 'sample.tsv')
        .attach('clinicalFiles', files[2], 'donor.invalid.tsv')
        .attach('clinicalFiles', files[3], 'thisissample.tsv')
        .end((err: any, res: any) => {
          res.should.have.status(400);
          res.body.should.deep.eq([
            {
              msg: 'Found multiple files of donor type - [donor.tsv,donor.invalid.tsv]',
              code: 'MULTIPLE_TYPED_FILES',
            },
            {
              msg:
                'Invalid file(s) - [thisissample.tsv], must start with entity and have .tsv extension (e.g. donor*.tsv)',
              code: 'INVALID_FILE_NAME',
            },
          ]);
          done();
        });
    });
    it('should return invalid and data errors for validation request of invalid submission', done => {
      let file: Buffer;
      try {
        file = fs.readFileSync(__dirname + '/donor.tsv');
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
                      type: 'ID_NOT_REGISTERED',
                      fieldName: 'submitter_donor_id',
                      info: {
                        donorSubmitterId: 'ICGC_0001',
                        value: 'ICGC_0001',
                      },
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
        file = fs.readFileSync(__dirname + '/donor.tsv');
      } catch (err) {
        return err;
      }
      // insert donor into db
      await insertData(dburl, 'donors', {
        followUps: [],
        treatments: [],
        chemotherapy: [],
        HormoneTherapy: [],
        gender: 'Male',
        submitterId: 'ICGC_0001',
        programId: 'ABCD-EF',
        specimens: [],
        donorId: 1,
      });
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
                  res.body.submission.state.should.eq(SUBMISSION_STATE.VALID);
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
  });

  describe('schema', function() {
    it('get template found', done => {
      const name = 'registration';
      console.log("Getting template for '" + name + "'...");
      chai
        .request(app)
        .get('/submission/schema/template/' + name)
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .end((err: any, res: any) => {
          res.should.have.status(200);
          res.text.should.equal(
            'program_id\tsubmitter_donor_id\tgender\t' +
              'submitter_specimen_id\tspecimen_type\ttumour_normal_designation\t' +
              'submitter_sample_id\tsample_type\n',
          );
          res.should.header('Content-type', 'text/tab-separated-values;' + ' charset=utf-8');
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
  chai.expect(donorsFromDB[0]).to.deep.include(comittedDonors2[0]);
}

async function asserCommitExistingSamplesOK(res: any) {
  res.should.have.status(200);
  chai.expect(res.body).to.deep.eq({
    newSamples: [],
  });
  const donorsFromDB = await donorDao.findByProgramId('ABCD-EF');
  chai.expect(donorsFromDB[0]).to.deep.include(comittedDonors2[0]);
}

async function assertFirstCommitDonorsCreatedInDB(res: any, rows: any[], dburl: string) {
  res.should.have.status(200);
  const donorRows: any[] = [];
  rows.forEach((r, idx) => {
    const i = idx + 1;
    donorRows.push(
      emptyDonorDocument({
        donorId: i,
        gender: r[FieldsEnum.gender],
        submitterId: r[FieldsEnum.submitter_donor_id],
        programId: r[FieldsEnum.program_id],
        specimens: [
          {
            specimenId: i,
            submitterId: r[FieldsEnum.submitter_specimen_id],
            specimenType: r[FieldsEnum.specimen_type],
            tumourNormalDesignation: r[FieldsEnum.tumour_normal_designation],
            samples: [
              {
                sampleId: i,
                sampleType: r[FieldsEnum.sample_type],
                submitterId: r[FieldsEnum.submitter_sample_id],
              },
            ],
          },
        ],
      }),
    );
  });

  const conn = await mongo.connect(dburl);
  const donors: any[] | null = await conn
    .db('clinical')
    .collection('donors')
    .find({})
    .sort('donorId', 1)
    .toArray();
  await conn.close();

  chai.expect(donors.length).to.eq(4);
  donorRows.forEach((dr, i) => {
    chai.expect(donors[i]).to.deep.include(dr);
  });
  if (!donors) {
    throw new Error("saved registration shouldn't be null");
  }
}

async function assertUploadOKRegistrationCreated(res: any, dburl: string) {
  res.should.have.status(201);
  const conn = await mongo.connect(dburl);
  const savedRegistration: ActiveRegistration | null = await conn
    .db('clinical')
    .collection('activeregistrations')
    .findOne({});
  await conn.close();
  console.log(' registration in db ', savedRegistration);
  if (!savedRegistration) {
    throw new Error("saved registration shouldn't be null");
  }
}

async function assertDbCollectionEmpty(dburl: string, collection: string) {
  const conn = await mongo.connect(dburl);
  const count = await conn
    .db('clinical')
    .collection(collection)
    .count({});
  await conn.close();
  chai.expect(count).to.eq(0);
}

const comittedDonors2: Donor[] = [
  {
    followUps: [],
    treatments: [],
    chemotherapy: [],
    HormoneTherapy: [],
    gender: 'Male',
    submitterId: 'abcd-125',
    programId: 'ABCD-EF',
    specimens: [
      {
        samples: [
          {
            sampleType: 'polyA+ RNA',
            submitterId: 'sm123-4',
            sampleId: 1,
          },
        ],
        specimenType: 'Bone marrow',
        tumourNormalDesignation: 'Xenograft - derived from primary tumour',
        submitterId: 'ss123-jdjr-ak',
        specimenId: 1,
      },
    ],
    donorId: 1,
  },
  {
    followUps: [],
    treatments: [],
    chemotherapy: [],
    HormoneTherapy: [],
    gender: 'Female',
    submitterId: 'abcd-126',
    programId: 'ABCD-EF',
    specimens: [
      {
        samples: [
          {
            sampleType: 'Ribo-Zero RNA',
            submitterId: 'sm123-5',
            sampleId: 2,
          },
        ],
        specimenType: 'Serum',
        tumourNormalDesignation: 'Cell line - derived from xenograft tissue',
        submitterId: 'ss123-sjdm',
        specimenId: 2,
      },
      {
        samples: [
          {
            sampleType: 'ctDNA',
            submitterId: 'sm123-00-1',
            sampleId: 5,
          },
        ],
        specimenType: 'FFPE',
        tumourNormalDesignation: 'Normal',
        submitterId: 'ss123-sjdm-2',
        specimenId: 5,
      },
    ],
    donorId: 2,
  },
  {
    followUps: [],
    treatments: [],
    chemotherapy: [],
    HormoneTherapy: [],
    gender: 'Male',
    submitterId: 'abcd-127',
    programId: 'ABCD-EF',
    specimens: [
      {
        samples: [
          {
            sampleType: 'polyA+ RNA',
            submitterId: 'sm123-6',
            sampleId: 3,
          },
        ],
        specimenType: 'Pleural effusion',
        tumourNormalDesignation: 'Primary tumour - adjacent to normal',
        submitterId: 'ss123-1123',
        specimenId: 3,
      },
    ],
    donorId: 3,
  },
  {
    followUps: [],
    treatments: [],
    chemotherapy: [],
    HormoneTherapy: [],
    gender: 'Female',
    submitterId: 'abcd-128',
    programId: 'ABCD-EF',
    specimens: [
      {
        samples: [
          {
            sampleType: 'ctDNA',
            submitterId: 'sm123-7',
            sampleId: 4,
          },
        ],
        specimenType: 'FFPE',
        tumourNormalDesignation: 'Metastatic tumour',
        submitterId: 'ss123=@@abnc',
        specimenId: 4,
      },
      {
        samples: [
          {
            sampleType: 'ctDNA',
            submitterId: 'sm128-1',
            sampleId: 7,
          },
        ],
        specimenType: 'FFPE',
        tumourNormalDesignation: 'Metastatic tumour',
        submitterId: 'ss123=@@abnc0',
        specimenId: 7,
      },
    ],
    donorId: 4,
  },
  {
    followUps: [],
    treatments: [],
    chemotherapy: [],
    HormoneTherapy: [],
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
            sampleId: 6,
          },
        ],
        specimenType: 'Pleural effusion',
        tumourNormalDesignation: 'Metastatic tumour',
        submitterId: 'ss123-129',
        specimenId: 6,
      },
    ],
    donorId: 5,
  },
  {
    followUps: [],
    treatments: [],
    chemotherapy: [],
    HormoneTherapy: [],
    gender: 'Male',
    submitterId: 'abcd-200',
    programId: 'ABCD-EF',
    specimens: [
      {
        samples: [
          {
            sampleType: 'Amplified DNA',
            submitterId: 'sm200-1',
            sampleId: 8,
          },
        ],
        specimenType: 'Blood derived',
        tumourNormalDesignation: 'Recurrent tumour',
        submitterId: 'ss200-1',
        specimenId: 8,
      },
    ],
    donorId: 6,
  },
];
