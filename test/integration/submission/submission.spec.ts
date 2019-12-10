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
import {
  cleanCollection,
  insertData,
  emptyDonorDocument,
  resetCounters,
  generateDonor,
  assertDbCollectionEmpty,
  findInDb,
  createDonorDoc,
} from '../testutils';
import { TEST_PUB_KEY, JWT_CLINICALSVCADMIN, JWT_ABCDEF, JWT_WXYZEF } from '../test.jwt';
import {
  ActiveRegistration,
  ActiveClinicalSubmission,
  FieldsEnum,
  SUBMISSION_STATE,
  DataValidationErrors,
  SubmissionBatchErrorTypes,
  ClinicalEntitySchemaNames,
  DonorFieldsEnum,
} from '../../../src/submission/submission-entities';
import { TsvUtils } from '../../../src/utils';
import { donorDao } from '../../../src/clinical/donor-repo';
import { Donor } from '../../../src/clinical/clinical-entities';
import AdmZip from 'adm-zip';

import * as _ from 'lodash';
import { SchemasDictionary } from '../../../src/lectern-client/schema-entities';
import { DictionaryMigration } from '../../../src/submission/schema/migration-entities';

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
    fieldName: FieldsEnum.tumour_normal_designation,
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
    fieldName: FieldsEnum.gender,
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
    fieldName: FieldsEnum.sample_type,
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
    type: DataValidationErrors.INVALID_PROGRAM_ID,
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
        [FieldsEnum.program_id]: 'ABCD-EF',
        [FieldsEnum.submitter_donor_id]: 'abcd123',
        [FieldsEnum.gender]: 'Male',
        [FieldsEnum.submitter_specimen_id]: 'ss123',
        [FieldsEnum.specimen_tissue_source]: 'Other',
        [FieldsEnum.tumour_normal_designation]: 'Normal',
        [FieldsEnum.submitter_sample_id]: 'sm123',
        [FieldsEnum.sample_type]: 'ctDNA',
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
      [FieldsEnum.program_id]: 'ABCD-EF',
      [FieldsEnum.submitter_donor_id]: 'abcd123',
      [FieldsEnum.gender]: 'Male',
      [FieldsEnum.submitter_specimen_id]: 'ss123',
      [FieldsEnum.specimen_tissue_source]: 'Other',
      [FieldsEnum.tumour_normal_designation]: 'Normal',
      [FieldsEnum.submitter_sample_id]: 'sm123',
      [FieldsEnum.sample_type]: 'ctDNA',
    },
  ],
};
const expectedDonorErrors = [
  {
    index: 1,
    type: 'FOUND_IDENTICAL_IDS',
    info: {
      value: 'ICGC_0001',
      donorSubmitterId: 'ICGC_0001',
      conflictingRows: [2],
    },
    message:
      'You are trying to submit the same [submitter_donor_id] in multiple rows. [submitter_donor_id] can only be submitted once per file.',
    fieldName: FieldsEnum.submitter_donor_id,
  },
  {
    index: 2,
    type: 'FOUND_IDENTICAL_IDS',
    info: {
      value: 'ICGC_0001',
      donorSubmitterId: 'ICGC_0001',
      conflictingRows: [1],
    },
    message:
      'You are trying to submit the same [submitter_donor_id] in multiple rows. [submitter_donor_id] can only be submitted once per file.',
    fieldName: FieldsEnum.submitter_donor_id,
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

const INVALID_FILENAME_ERROR =
  'Please retain the template file name and only append characters to the end. For example, sample_registration<_optional_extension>.tsv';

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
const schemaName = 'ARGO Clinical Submission';
const schemaVersion = '1.0';

describe('Submission Api', () => {
  let mongoContainer: any;
  let dburl = ``;
  // will run when all tests are finished
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
    this.beforeEach(async () => await clearCollections(dburl, ['donors', 'activeregistrations']));

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
        file = fs.readFileSync(__dirname + `/${ClinicalEntitySchemaNames.REGISTRATION}.tsv`);
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
        file = fs.readFileSync(__dirname + `/${ClinicalEntitySchemaNames.REGISTRATION}.1.tsv`);
        (async () =>
          (rows = (await TsvUtils.tsvToJson(
            __dirname + `/${ClinicalEntitySchemaNames.REGISTRATION}.1.tsv`,
          )) as any[]))();
      } catch (err) {
        return done(err);
      }

      try {
        file2 = fs.readFileSync(__dirname + `/${ClinicalEntitySchemaNames.REGISTRATION}.2.tsv`);
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

    it('should commit registration, detect already registered', done => {
      let file: Buffer;
      let rows: any[];
      try {
        file = fs.readFileSync(__dirname + `/${ClinicalEntitySchemaNames.REGISTRATION}.1.tsv`);
        (async () =>
          (rows = (await TsvUtils.tsvToJson(
            __dirname + `/${ClinicalEntitySchemaNames.REGISTRATION}.1.tsv`,
          )) as any[]))();
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
            chai
              .expect(res.body.registration.stats.newSampleIds)
              .to.deep.eq([
                { submitterId: 'sm123-4', rowNumbers: [0] },
                { submitterId: 'sm123-5', rowNumbers: [1] },
                { submitterId: 'sm123-6', rowNumbers: [2] },
                { submitterId: 'sm123-7', rowNumbers: [3] },
              ]);
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
                      file,
                      `${ClinicalEntitySchemaNames.REGISTRATION}.1.tsv`,
                    )
                    .end(async (err: any, res: any) => {
                      try {
                        await assertUploadOKRegistrationCreated(res, dburl);
                        const reg2Id = res.body.registration._id;
                        chai.expect(reg2Id).to.not.eq(reg1Id);
                        chai.expect(res.body.registration.stats.newSampleIds).to.deep.eq([]);
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
        file = fs.readFileSync(__dirname + `/${ClinicalEntitySchemaNames.REGISTRATION}.tsv`);
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
          __dirname + `/${ClinicalEntitySchemaNames.REGISTRATION}.invalid.tsv`,
        );
      } catch (err) {
        throw err;
      }
      chai
        .request(app)
        .post('/submission/program/ABCD-EF/registration')
        .type('form')
        .attach('registrationFile', file, `${ClinicalEntitySchemaNames.REGISTRATION}.invalid.tsv`)
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
            res.should.have.status(422);
            res.body.batchErrors.should.deep.include({
              message: INVALID_FILENAME_ERROR,
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
        file = fs.readFileSync(__dirname + '/sample_registration-invalidHeaders.tsv');
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
      let file: Buffer;
      try {
        file = fs.readFileSync(__dirname + '/donor.invalid.tsv');
      } catch (err) {
        return done(err);
      }
      chai
        .request(app)
        // data base is empty so ID shouldn't exist
        .post('/submission/program/ABCD-EF/clinical/upload')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .attach('clinicalFiles', file, 'donor.invalid.tsv')
        .end((err: any, res: any) => {
          res.should.have.status(207);
          res.body.submission.clinicalEntities.donor.schemaErrors.should.deep.eq(
            expectedDonorErrors,
          );
          res.body.successful.should.deep.eq(false);
          done();
        });
    });
    it('should return 200 if try to upload valid tsv files', done => {
      let file: Buffer;
      try {
        file = fs.readFileSync(__dirname + '/donor.tsv');
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
        files.push(fs.readFileSync(__dirname + '/donor.tsv'));
        files.push(fs.readFileSync(__dirname + '/thisissample.tsv'));
        files.push(fs.readFileSync(__dirname + '/donor.invalid.tsv'));
        files.push(fs.readFileSync(__dirname + '/specimen-invalid-headers.tsv'));
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
        .end((err: any, res: any) => {
          res.should.have.status(207);
          res.body.batchErrors.should.deep.eq([
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
              message: `Missing required headers: [${FieldsEnum.submitter_donor_id}], [${FieldsEnum.submitter_specimen_id}]`,
              batchNames: ['specimen-invalid-headers.tsv'],
              code: SubmissionBatchErrorTypes.MISSING_REQUIRED_HEADER,
            },
            {
              message: 'Found unknown headers: [submitter_id], [submitter_specmen_id]',
              batchNames: ['specimen-invalid-headers.tsv'],
              code: SubmissionBatchErrorTypes.UNRECOGNIZED_HEADER,
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
        files.push(fs.readFileSync(__dirname + '/donor.invalid.tsv'));
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
                      type: DataValidationErrors.ID_NOT_REGISTERED,
                      fieldName: FieldsEnum.submitter_donor_id,
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
        file = fs.readFileSync(__dirname + '/donor.tsv');
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
        files.push(fs.readFileSync(__dirname + '/donor.tsv'));
        files.push(fs.readFileSync(__dirname + '/specimen.tsv'));
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
            tumourNormalDesignation: 'Normal',
            submitterId: '8013861',
            clinicalInfo: {
              program_id: 'ABCD-EF',
              submitter_donor_id: 'ICGC_0001',
              submitter_specimen_id: '8013861',
              acquisition_interval: 200,
              anatomic_location_of_specimen_collection: 'Other',
              central_pathology_confirmed: 'No',
              tumour_histological_type: 'M-1111/22',
              tumour_grading_system: 'Default',
              tumour_grade: 'aStringValue',
              tumour_staging_system: 'Murphy',
              pathological_stage_group: 'aStringValue',
              percent_proliferating_cells: 0.5,
              percent_inflammatory_tissue: 0.6,
              percent_stromal_cells: 0.65,
              percent_necrosis: 0.65,
              percent_tumour_cells: 0.5,
            },
          },
        ],
        donorId: 1,
      });
      return chai
        .request(app)
        .post('/submission/program/ABCD-EF/clinical/upload')
        .auth(JWT_ABCDEF, { type: 'bearer' })
        .attach('clinicalFiles', files[0], 'donor.tsv')
        .attach('clinicalFiles', files[1], 'specimen.tsv')
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
                  res.body.submission.clinicalEntities.donor.stats.new.should.deep.eq([0]);
                  res.body.submission.clinicalEntities.specimen.stats.updated.should.deep.eq([0]);
                  res.body.submission.clinicalEntities.specimen.dataUpdates.should.deep.eq([
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
        donorFile = fs.readFileSync(__dirname + '/donor.tsv');
        specimenFile = fs.readFileSync(__dirname + '/specimen.tsv');
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
        file = fs.readFileSync(__dirname + `/${fileName}`);
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
          chai.expect(updatedDonor).to.deep.include(donor);
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

    const uploadSubmission = async (fileName: string = 'donor.tsv') => {
      let file: Buffer;
      try {
        file = fs.readFileSync(__dirname + `/${fileName}`);
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
        });
    };

    const uploadSubmissionWithUpdates = async () => {
      let file: Buffer;
      try {
        file = fs.readFileSync(__dirname + '/donor-with-updates.tsv');
      } catch (err) {
        return err;
      }

      return await chai
        .request(app)
        .post(`/submission/program/${programId}/clinical/upload`)
        .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
        .attach('clinicalFiles', file, 'donor.tsv')
        .then((res: any) => {
          submissionVersion = res.body.submission.version;
        });
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
      await uploadSubmission();
      await validateSubmission();
      await commitActiveSubmission();
      // Now we need to have a submission with updates, and validate to get it into the correct state
      await uploadSubmissionWithUpdates();
      await validateSubmission();
      await commitActiveSubmission();
      const [donorBeforeApproveCommit] = await findInDb(dburl, 'donors', {
        programId: programId,
        submitterId: 'ICGC_0001',
      });
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
          // merge shouldn't have mutated donor except for donor.clinicalInfo
          chai
            .expect(updatedDonor)
            .to.deep.include(
              _.omit(donorBeforeApproveCommit, ['__v', 'updatedAt', 'clinicalInfo']),
            );
          chai
            .expect(updatedDonor.clinicalInfo)
            .to.deep.include({ [DonorFieldsEnum.vital_status]: 'Alive' });
        });
    });

    it.only('should mark updated invalid donors as valid when they are approved', async () => {
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
            submitter_donor_id: 'ICGC_0001.1',
            vital_status: 'InvalidOldValue',
            cause_of_death: 'Died of other reasons',
            survival_time: 540,
          },
        }),
      );
      await uploadSubmission('donor2.tsv');
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

          chai.expect(updatedDonor.schemaMetadata.isValid).to.be.true;
          chai.expect(updatedDonor.schemaMetadata.lastValidSchemaVersion).to.eq('1.0');
          chai.expect(updatedDonor.clinicalInfo).to.deep.include({
            [DonorFieldsEnum.vital_status]: 'Deceased',
            [DonorFieldsEnum.survival_time]: 100,
          });
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
            `${FieldsEnum.program_id}\t${FieldsEnum.submitter_donor_id}\t${FieldsEnum.gender}\t` +
              `${FieldsEnum.submitter_specimen_id}\t${FieldsEnum.specimen_tissue_source}\t${FieldsEnum.tumour_normal_designation}\t` +
              `${FieldsEnum.submitter_sample_id}\t${FieldsEnum.sample_type}\n`,
          );
          res.should.header('Content-type', 'text/tab-separated-values;' + ' charset=utf-8');
          done();
        });
    });
    it('get all templates zip', done => {
      let refZip: AdmZip;
      try {
        refZip = new AdmZip(__dirname + '/all.zip');
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

          chai.expect(refFiles).to.eql(downloadedFiles);
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

    describe('schema migration api', () => {
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
      });

      const donor2: Donor = emptyDonorDocument({
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

      this.beforeEach(async () => {
        await clearCollections(dburl, ['donors', 'dictionarymigrations']);
        await insertData(dburl, 'donors', donor);
        await insertData(dburl, 'donors', donor2);
        // reset the base schema since tests can load new one
        await bootstrap.loadSchema(schemaName, schemaVersion);
      });

      // very simple smoke test of the migration to be expanded along developement
      it('should update the schema ', async () => {
        await chai
          .request(app)
          .patch('/submission/schema?sync=true')
          .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
          .send({
            version: '2.0',
          })
          .then(async (res: any) => {
            res.should.have.status(200);
            res.body.version.should.eq('2.0');

            const schema = (await findInDb(dburl, 'dataschemas', {})) as SchemasDictionary[];
            schema[0].version.should.eq('2.0');
          });

        await chai
          .request(app)
          .get('/submission/schema/migration/')
          .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
          .then(async (res: any) => {
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
          });
      });

      describe('dry run migration api', () => {
        it('should report donor validation errors', async () => {
          await chai
            .request(app)
            .post('/submission/schema/dry-run-update')
            .send({
              version: '2.0',
            })
            .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
            .then(async (res: any) => {
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
              migration.stats.validDocumentsCount.should.eq(1);
              migration.stats.totalProcessed.should.eq(2);
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
            });
        });
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
            specimenTissueSource: r[FieldsEnum.specimen_tissue_source],
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
            sampleId: 1,
          },
        ],
        specimenTissueSource: 'Bone marrow',
        tumourNormalDesignation: 'Xenograft - derived from primary tumour',
        submitterId: 'ss123-jdjr-ak',
        specimenId: 1,
      },
    ],
    donorId: 1,
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
            sampleId: 2,
          },
        ],
        specimenTissueSource: 'Serum',
        tumourNormalDesignation: 'Xenograft - derived from primary tumour',
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
        specimenTissueSource: 'Other',
        tumourNormalDesignation: 'Normal',
        submitterId: 'ss123-sjdm-2',
        specimenId: 5,
      },
    ],
    donorId: 2,
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
            sampleId: 3,
          },
        ],
        specimenTissueSource: 'Pleural effusion',
        tumourNormalDesignation: 'Primary tumour - adjacent to normal',
        submitterId: 'ss123-1123',
        specimenId: 3,
      },
    ],
    donorId: 3,
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
            sampleId: 4,
          },
        ],
        specimenTissueSource: 'Other',
        tumourNormalDesignation: 'Metastatic tumour',
        submitterId: 'ss123-abnc',
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
        specimenTissueSource: 'Other',
        tumourNormalDesignation: 'Metastatic tumour',
        submitterId: 'ss123-abnc0',
        specimenId: 7,
      },
    ],
    donorId: 4,
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
            sampleId: 6,
          },
        ],
        specimenTissueSource: 'Pleural effusion',
        tumourNormalDesignation: 'Metastatic tumour',
        submitterId: 'ss123-129',
        specimenId: 6,
      },
    ],
    donorId: 5,
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
            sampleId: 8,
          },
        ],
        specimenTissueSource: 'Blood derived',
        tumourNormalDesignation: 'Recurrent tumour',
        submitterId: 'ss200-1',
        specimenId: 8,
      },
    ],
    donorId: 6,
  },
];
