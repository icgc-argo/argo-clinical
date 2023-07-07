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

import chai from 'chai';
// needed for typescript
import 'chai-http';
import 'mocha';
import { GenericContainer } from 'testcontainers';
import app from '../../../src/app';
import * as bootstrap from '../../../src/bootstrap';
import {
  cleanCollection,
  insertData,
  assertDbCollectionEmpty,
  emptyDonorDocument,
} from '../testutils';
import { TEST_PUB_KEY, JWT_CLINICALSVCADMIN, JWT_ABCDEF } from '../test.jwt';
import mongoose from 'mongoose';
import AdmZip from 'adm-zip';
import { ClinicalEntitySchemaNames } from '../../../src/common-model/entities';
import { TsvUtils, notEmpty } from '../../../src/utils';
import { getClinicalEntitiesFromDonorBySchemaName } from '../../../src/common-model/functions';
import deepEqualInAnyOrder from 'deep-equal-in-any-order';
import _ from 'lodash';

chai.use(require('chai-http'));
chai.use(deepEqualInAnyOrder);
chai.should();

describe('clinical Api', () => {
  let mongoContainer: any;
  let dburl = ``;

  const programId = 'PACA-AU';
  const donorRegistrationRecord = {
    program_id: programId,
    submitter_donor_id: '1234abcd',
    gender: 'Male',
    submitter_specimen_id: 'ss200-1',
    specimen_tissue_source: 'Blood derived',
    tumour_normal_designation: 'Tumour',
    specimen_type: 'Recurrent tumour',
    submitter_sample_id: 'sm200-1',
    sample_type: 'Amplified DNA',
  };
  const donorDoc = {
    followUps: [],
    treatments: [],
    chemotherapy: [],
    hormoneTherapy: [],
    donorId: 4001,
    gender: donorRegistrationRecord.gender,
    submitterId: donorRegistrationRecord.submitter_donor_id,
    programId: donorRegistrationRecord.program_id,
    specimens: [
      {
        samples: [
          {
            sampleType: donorRegistrationRecord.sample_type,
            submitterId: donorRegistrationRecord.submitter_sample_id,
            sampleId: 3002,
          },
        ],
        specimenTissueSource: donorRegistrationRecord.specimen_tissue_source,
        tumourNormalDesignation: donorRegistrationRecord.tumour_normal_designation,
        specimenType: donorRegistrationRecord.specimen_type,
        submitterId: donorRegistrationRecord.submitter_specimen_id,
        specimenId: 893,
        clinicalInfo: {
          program_id: donorRegistrationRecord.program_id,
          submitter_donor_id: donorRegistrationRecord.submitter_donor_id,
          submitter_specimen_id: donorRegistrationRecord.submitter_specimen_id,
          specimen_anatomic_location: 'other',
        },
      },
    ],
    clinicalInfo: {
      program_id: donorRegistrationRecord.program_id,
      submitter_donor_id: donorRegistrationRecord.submitter_donor_id,
      vital_status: 'Alive',
    },
  };

  // will run when all tests are finished
  before(() => {
    return (async () => {
      try {
        mongoContainer = await new GenericContainer('mongo', '4.0').withExposedPorts(27017).start();
        dburl = `mongodb://${mongoContainer.getContainerIpAddress()}:${mongoContainer.getMappedPort(
          27017,
        )}/clinical`;
        console.log(`mongo test container started ${dburl}`);
        await bootstrap.run({
          mongoPassword() {
            return '';
          },
          mongoUser() {
            return '';
          },
          mongoUrl: () => {
            return dburl;
          },
          initialSchemaVersion() {
            return '1.0';
          },
          schemaName() {
            return 'ARGO Clinical Submission';
          },
          jwtPubKey() {
            return TEST_PUB_KEY;
          },
          jwtPubKeyUrl() {
            return '';
          },
          schemaServiceUrl() {
            return `file://${__dirname}/../stub-schema.json`;
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
              database: '',
              host: '',
              password: '',
              port: 0,
              timeout: 0,
              user: '',
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
    return;
  });

  describe('donor endpoints', function() {
    const donor = emptyDonorDocument(donorDoc);
    this.beforeEach(async () => {
      try {
        await cleanCollection(dburl, 'donors');
        await insertData(dburl, 'donors', donor);
        return;
      } catch (err) {
        console.error(err);
        return err;
      }
    });

    describe('id endpoints', function() {
      it('/clinical/donors/id should return donor id if it exists', async function() {
        console.log('before /donor/id request');
        return chai
          .request(app)
          .get('/clinical/donors/id?programId=PACA-AU&submitterId=1234abcd')
          .then((res: any) => {
            console.log('asserting /donor/id response');
            res.should.have.status(200);
            res.type.should.eq('text/plain');
            res.text.should.eq('DO4001');
          });
      });

      it('/clinical/samples/id should return sample id if it exists', async function() {
        return chai
          .request(app)
          .get('/clinical/samples/id?programId=PACA-AU&submitterId=sm200-1')
          .then((res: any) => {
            res.should.have.status(200);
            res.type.should.eq('text/plain');
            res.text.should.eq('SA3002');
          });
      });

      it('/clinical/specimens/id should return specimen id if it exists', async function() {
        return chai
          .request(app)
          .get('/clinical/specimens/id?programId=PACA-AU&submitterId=ss200-1')
          .then((res: any) => {
            res.should.have.status(200);
            res.type.should.eq('text/plain');
            res.text.should.eq('SP893');
          });
      });

      it('/clinical/donors/id should return 404 if no id found', async function() {
        return chai
          .request(app)
          .get('/clinical/donors/id?programId=PACA-A&submitterId=1234abcd')
          .then((res: any) => {
            res.should.have.status(404);
          });
      });

      it('/clinical/samples/id should return sample id if no id found', async function() {
        return chai
          .request(app)
          .get('/clinical/samples/id?programId=PACA-AU&submitterId=sm20-1')
          .then((res: any) => {
            res.should.have.status(404);
          });
      });

      it('/clinical/specimens/id should return specimen id if no id found', async function() {
        return chai
          .request(app)
          .get('/clinical/specimens/id?programId=PACA-AU&submitterId=ss2001')
          .then((res: any) => {
            res.should.have.status(404);
          });
      });

      it('/clinical/program/:programId/clinical-data should return clinical data', async function() {
        return chai
          .request(app)
          .post('/clinical/program/PACA-CA/clinical-data?page=0&limit=20')
          .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
          .then((res: any) => {
            res.should.have.status(200);
            res.body.should.have.property('clinicalEntities');
          });
      });

      it('/clinical/program/:programId/clinical-errors should return clinical errors', async function() {
        return chai
          .request(app)
          .post('/clinical/program/PACA-CA/clinical-errors')
          .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
          .then((res: any) => {
            res.should.have.status(200);
            res.body.should.be.an('array');
          });
      });
    }); // end of id endpoints

    describe('dev/test enpoints', function() {
      it('/clinical/donors should allow delete with proper auth', async function() {
        return chai
          .request(app)
          .delete('/clinical/donors?programId=PACA-AU')
          .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
          .then(async (res: any) => {
            res.should.have.status(200);
            await assertDbCollectionEmpty(dburl, 'donors');
          });
      });
      it('/clinical/donors should not allow delete without proper auth', async function() {
        return chai
          .request(app)
          .delete('/clinical/donors?programId=PACA-AU')
          .auth(JWT_ABCDEF, { type: 'bearer' })
          .then((res: any) => {
            res.should.have.status(403);
          });
      });
    });

    describe('export endpoints', function() {
      it('shoud download zip file with tsvs of program clinical data', done => {
        chai
          .request(app)
          .get(`/clinical/program/${programId}/tsv-export`)
          .auth(JWT_CLINICALSVCADMIN, { type: 'bearer' })
          .buffer()
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
            const zipFile = res.body as AdmZip;

            // check files are present
            const fileNames: string[] = zipFile.getEntries().map(file => file.name);
            chai
              .expect(fileNames)
              .to.deep.equalInAnyOrder(['sample_registration.tsv', 'donor.tsv', 'specimen.tsv']);

            // check file contents
            zipFile.getEntries().forEach(file => {
              const entity = file.name.replace('.tsv', '') as ClinicalEntitySchemaNames;

              const tsvStr = file.getData().toString();
              const fileRecords = TsvUtils.parseTsvToJson(tsvStr);

              let donorEntityRecords;
              if (entity === ClinicalEntitySchemaNames.REGISTRATION) {
                donorEntityRecords = [donorRegistrationRecord];
              } else {
                donorEntityRecords = getClinicalEntitiesFromDonorBySchemaName(donor, entity);
              }

              chai
                .expect(fileRecords.map(r => _.pickBy(r, notEmpty))) // ignore empty fields
                .to.deep.equalInAnyOrder(donorEntityRecords);
            });

            return done();
          });
      });
    });
  }); // end of donor apis
}); // end of clinical apis
