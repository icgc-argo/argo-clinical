/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
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

import { donorDao, DONOR_DOCUMENT_FIELDS } from './donor-repo';
import { Errors } from '../utils';
import { Sample, Donor } from './clinical-entities';
import { ClinicalQuery } from './clinical-api';
import { DeepReadonly } from 'deep-freeze';
import _ from 'lodash';
import { forceRecalcDonorCoreEntityStats } from '../submission/submission-to-clinical/stat-calculator';
import * as dictionaryManager from '../dictionary/manager';
import { loggerFor } from '../logger';
import { WorkerTasks } from './service-worker-thread/tasks';
import { runTaskInWorkerThread } from './service-worker-thread/runner';

const L = loggerFor(__filename);

export async function updateDonorSchemaMetadata(
  donor: DeepReadonly<Donor>,
  migrationId: string,
  isValid: boolean,
  newSchemaVersion?: string,
) {
  const donorCopy = _.cloneDeep(donor) as Donor;
  if (!donorCopy.schemaMetadata) {
    throw new Error('donor document without metadata.. fix it');
  }

  donorCopy.schemaMetadata.isValid = isValid;
  donorCopy.schemaMetadata.lastMigrationId = migrationId;
  if (isValid && newSchemaVersion) {
    donorCopy.schemaMetadata.lastValidSchemaVersion = newSchemaVersion;
  }
  return await donorDao.update(donorCopy);
}

export async function updateMigrationId(donor: DeepReadonly<Donor>, migrationId: string) {
  const donorCopy = _.cloneDeep(donor) as Donor;
  if (!donorCopy.schemaMetadata) {
    throw new Error('donor document without metadata.. fix it');
  }

  donorCopy.schemaMetadata.lastMigrationId = migrationId;
  return await donorDao.update(donorCopy);
}

export async function getDonorsByMigrationId(migrationId: string, limit: number) {
  return await donorDao.findBy(
    {
      $or: [
        { [DONOR_DOCUMENT_FIELDS.LAST_MIGRATION_ID]: { $ne: migrationId } },
        { [DONOR_DOCUMENT_FIELDS.LAST_MIGRATION_ID]: undefined },
        { [DONOR_DOCUMENT_FIELDS.LAST_MIGRATION_ID]: { $exists: false } },
      ],
    },
    limit,
  );
}

export async function getDonors(programId: string) {
  if (programId) {
    return await donorDao.findByProgramId(programId);
  }
  return await donorDao.findBy({}, 999);
}

export async function findDonorId(submitterId: string, programId: string) {
  const donor = await findDonorBySubmitterId(submitterId, programId);
  if (!donor) {
    throw new Errors.NotFound('Donor not found');
  }
  return `DO${donor.donorId}`;
}

export async function findSpecimenId(submitterId: string, programId: string) {
  const donor = await donorDao.findBySpecimenSubmitterIdAndProgramId({ submitterId, programId });
  if (!donor) {
    throw new Errors.NotFound('Specimen not found');
  }
  const specimen = donor.specimens.find(sp => sp.submitterId == submitterId);
  if (!specimen) {
    throw new Error('not possible, check your query');
  }
  return `SP${specimen.specimenId}`;
}

export async function findSampleId(submitterId: string, programId: string) {
  const donor = await donorDao.findBySampleSubmitterIdAndProgramId({ submitterId, programId });
  if (!donor) {
    throw new Errors.NotFound('Sample not found');
  }

  let sample: Sample | undefined = undefined;
  for (const sp of donor.specimens) {
    for (const sa of sp.samples) {
      if (sa.submitterId == submitterId) {
        sample = sa;
        break;
      }
    }
    if (sample) {
      break;
    }
  }

  if (!sample) {
    throw new Error('not possible, check your query');
  }
  return `SA${sample.sampleId}`;
}

export async function findDonorBySubmitterId(submitterId: string, programId: string) {
  return await donorDao.findOneBy({ programId, submitterId });
}

export async function findDonorByDonorId(donorId: number, programId: string) {
  return await donorDao.findOneBy({ programId, donorId });
}

export function iterateAllDonorsByProgramId(programId: string) {
  return donorDao.iterateAllByProgramId(programId);
}

export async function deleteDonors(programId: string) {
  return await donorDao.deleteByProgramId(programId);
}

export const updateDonorStats = async (donorId: number, coreCompletionOverride: any) => {
  const [donor] = await donorDao.findBy({ donorId: donorId }, 1);

  if (!donor) return undefined;

  // Update core
  const updatedDonor = forceRecalcDonorCoreEntityStats(donor, coreCompletionOverride);

  return await donorDao.update(updatedDonor);
};

export const getClinicalDataTsv = async (programId: string, query = {}) => {
  if (!programId) throw new Error('Missing programId!');
  const start = new Date().getTime() / 1000;

  // worker-threads can't get dictionary instance so deal with it here and pass it to worker task
  const allSchemasWithFields = await dictionaryManager.instance().getSchemasWithFields();

  // async/await functions just hang in current library worker-thread setup, root cause is unknown
  const donors = await donorDao.findByProgramId(programId, {}, true);

  const taskToRun = WorkerTasks.ExtractDataFromDonors;
  const taskArgs = [donors, allSchemasWithFields];
  const data = await runTaskInWorkerThread<
    { entityName: string; records: unknown; entityFields: any }[]
  >(taskToRun, taskArgs);

  const end = new Date().getTime() / 1000;
  L.debug(`getClinicalData took ${end - start}s`);

  return data;
};

export const getClinicalEntityData = async (programId: string, query: ClinicalQuery) => {
  if (!programId) throw new Error('Missing programId!');
  const start = new Date().getTime() / 1000;

  // worker-threads can't get dictionary instance so deal with it here and pass it to worker task
  const allSchemasWithFields = await dictionaryManager.instance().getSchemasWithFields();

  // async/await functions just hang in current library worker-thread setup, root cause is unknown
  const donors = await donorDao.findByPaginatedProgramId(programId, query);

  const taskToRun = WorkerTasks.ExtractDataFromDonors;
  const taskArgs = [donors, allSchemasWithFields];
  const data = await runTaskInWorkerThread<
    { entityName: string; records: unknown; entityFields: any }[]
  >(taskToRun, taskArgs);

  const end = new Date().getTime() / 1000;
  L.debug(`getClinicalData took ${end - start}s`);

  return data;
};

/*
  service.getClinicalEntityMigrationErrors(programId, entityType, donorIds):
  1. find latest succesful migration
    - dictionarymigrations collection
    - stage===COMPLETED AND dryRun===false
  2. for each donorId, look in the migration.invalidDonorsErrors and try to find a record with that donorId
    - if not found, no errors for that donor :)
    - if found, return the errors
*/

export const getClinicalEntityMigrationErrors = async (programId: string) => {
  if (!programId) throw new Error('Missing programId!');
  const start = new Date().getTime() / 1000;

  // worker-threads can't get dictionary instance so deal with it here and pass it to worker task
  const allSchemasWithFields = await dictionaryManager.instance().getSchemasWithFields();

  // async/await functions just hang in current library worker-thread setup, root cause is unknown
  // const donors = await donorDao.findByProgramId(programId, {}, true);

  // const taskToRun = WorkerTasks.ExtractDataFromDonors;
  // const taskArgs = [donors, allSchemasWithFields];
  // const data = await runTaskInWorkerThread<
  //   { entityName: string; records: unknown; entityFields: any }[]
  // >(taskToRun, taskArgs);

  const end = new Date().getTime() / 1000;
  L.debug(`getClinicalData took ${end - start}s`);
  console.log(programId);
  return programId;
};
