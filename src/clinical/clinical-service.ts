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

import { DeepReadonly } from 'deep-freeze';
import _ from 'lodash';
import { Sample, Donor, ClinicalEntityData } from './clinical-entities';
import { ClinicalQuery, ClinicalSearchQuery } from './clinical-api';
import { donorDao, DONOR_DOCUMENT_FIELDS } from './donor-repo';
import {
  aliasEntityNames,
  ClinicalEntitySchemaNames,
  ClinicalErrorsResponseRecord,
  EntityAlias,
} from '../common-model/entities';
import { Errors } from '../utils';
import { patchCoreCompletionWithOverride } from '../submission/submission-to-clinical/stat-calculator';
import { migrationRepo } from '../submission/migration/migration-repo';
import { MigrationManager } from '../submission/migration/migration-manager';
import {
  DictionaryMigration,
  DonorMigrationError,
} from '../submission/migration/migration-entities';
import * as dictionaryManager from '../dictionary/manager';
import { loggerFor } from '../logger';
import { WorkerTasks } from './service-worker-thread/tasks';
import { runTaskInWorkerThread } from './service-worker-thread/runner';
import { SchemaValidationError } from '@overturebio-stack/lectern-client/lib/schema-entities';

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
  const updatedDonor = patchCoreCompletionWithOverride(donor, coreCompletionOverride);

  return await donorDao.update(updatedDonor);
};

export const getClinicalData = async (programId: string) => {
  if (!programId) throw new Error('Missing programId!');
  const start = new Date().getTime() / 1000;

  // worker-threads can't get dictionary instance so deal with it here and pass it to worker task
  const allSchemasWithFields = await dictionaryManager.instance().getSchemasWithFields();

  // async/await functions just hang in current library worker-thread setup, root cause is unknown
  const donors = await donorDao.findByProgramId(programId, {}, true);

  const taskToRun = WorkerTasks.ExtractDataFromDonors;
  const taskArgs = [donors, allSchemasWithFields];
  const data = await runTaskInWorkerThread<ClinicalEntityData[]>(taskToRun, taskArgs);

  const end = new Date().getTime() / 1000;
  L.debug(`getClinicalData took ${end - start}s`);

  return data;
};

export const getPaginatedClinicalData = async (programId: string, query: ClinicalQuery) => {
  if (!programId) throw new Error('Missing programId!');
  const start = new Date().getTime() / 1000;

  const allSchemasWithFields = await dictionaryManager.instance().getSchemasWithFields();
  // Get all donors + records for given entity
  const { donors, totalDonors } = await donorDao.findByPaginatedProgramId(programId, query);

  const taskToRun = WorkerTasks.ExtractEntityDataFromDonors;
  const taskArgs = [donors as Donor[], totalDonors, allSchemasWithFields, query];

  // Return paginated data
  const data = await runTaskInWorkerThread<{ clinicalEntities: ClinicalEntityData[] }>(
    taskToRun,
    taskArgs,
  );

  const end = new Date().getTime() / 1000;
  L.debug(`getPaginatedClinicalData took ${end - start}s`);

  return data;
};

export const getClinicalSearchResults = async (programId: string, query: ClinicalSearchQuery) => {
  if (!programId) throw new Error('Missing programId!');
  const start = new Date().getTime() / 1000;

  // Get list of donorIds + submitterDonorIds matching search results
  const { donors } = await donorDao.findByProgramDonorSearch(programId, query);

  const taskToRun = WorkerTasks.FilterDonorIdDataFromSearch;
  const taskArgs = [donors as Donor[], query];
  const data = await runTaskInWorkerThread<number[]>(taskToRun, taskArgs);

  const end = new Date().getTime() / 1000;
  L.debug(`getPaginatedClinicalData took ${end - start}s`);

  return data;
};

interface DonorMigration extends Omit<DictionaryMigration, 'invalidDonorsErrors'> {
  invalidDonorsErrors: Array<DonorMigrationError>;
}

/**
 * Returns all errors from latest migration, plus date of migration.
 * Records are formatted for use on front end.
 */
export const getClinicalEntityMigrationErrors = async (
  programId: string,
  query: string[],
): Promise<{
  clinicalErrors: ClinicalErrorsResponseRecord[];
  migrationLastUpdated: string | undefined;
}> => {
  if (!programId) throw new Error('Missing programId!');
  const start = new Date().getTime() / 1000;

  const migration: DeepReadonly<
    DonorMigration | undefined
  > = await migrationRepo.getLatestSuccessful();

  const clinicalMigrationErrors: ClinicalErrorsResponseRecord[] = [];
  const migrationLastUpdated = migration?.updatedAt;

  if (migration) {
    const { invalidDonorsErrors }: DeepReadonly<DonorMigration> = migration;
    invalidDonorsErrors
      .filter(
        donor =>
          donor.programId.toString() === programId && query.includes(donor.donorId.toString()),
      )
      .forEach(donor => {
        const { donorId, submitterDonorId, errors } = donor;
        // Overwrite donor.errors + flatten entityName to simplify query
        // Input: Donor.Errors = [{ [entityName] : [{error}] }]
        // =>  Output: Donor.Errors = [{ ...error, entityName}]

        errors.forEach(entityErrorObject => {
          const currentEntityErrorData: [
            string,
            readonly DeepReadonly<SchemaValidationError>[],
          ] = Object.entries(entityErrorObject)[0];

          const entityName = currentEntityErrorData[0];
          const entityErrors = currentEntityErrorData[1];

          const updatedErrorEntries = entityErrors.map(error => ({
            ...error,
            donorId,
            entityName,
          }));

          const updatedDonorErrorData: ClinicalErrorsResponseRecord = {
            donorId,
            submitterDonorId,
            errors: updatedErrorEntries,
          };

          clinicalMigrationErrors.push(updatedDonorErrorData);
        });
      });
  }
  const end = new Date().getTime() / 1000;
  L.debug(`getClinicalEntityMigrationErrors took ${end - start}s`);

  return { clinicalErrors: clinicalMigrationErrors, migrationLastUpdated };
};

/**
 * Given a list of Program Migration Errors, this function finds related Donors,
 * and returns a list of DonorIds which are now Valid after submission.
 */
export const getValidRecordsPostSubmission = async (
  programId: string,
  migrationErrors: {
    clinicalErrors: ClinicalErrorsResponseRecord[];
    migrationLastUpdated: string | undefined;
  },
): Promise<{ validDonorIds: number[]; validRecords: ClinicalErrorsResponseRecord[] }> => {
  if (!programId) throw new Error('Missing programId!');

  const start = new Date().getTime() / 1000;
  const { clinicalErrors: clinicalMigrationErrors } = migrationErrors;
  const errorDonorIds = clinicalMigrationErrors.map(error => error.donorId);
  let errorEntities: Array<string | EntityAlias> = [];

  clinicalMigrationErrors.forEach(migrationError => {
    const { errors } = migrationError;
    errors.forEach(error => {
      console.log(error);
      const { entityName } = error;
      if (!errorEntities.includes(entityName)) errorEntities = [...errorEntities, entityName];
    });
  });

  const errorQuery: ClinicalQuery = {
    programShortName: programId,
    page: 0,
    sort: 'donorId',
    entityTypes: ['donor', ...errorEntities],
    donorIds: errorDonorIds,
    submitterDonorIds: [],
  };

  const donorData = (await donorDao.findByPaginatedProgramId(programId, errorQuery)).donors;

  const validDonorIds = donorData
    .filter(donor => donor.schemaMetadata.isValid)
    .map(({ donorId }) => Number(donorId));

  const validRecords: ClinicalErrorsResponseRecord[] = [];

  errorDonorIds
    .filter(donorId => !validDonorIds.includes(donorId))
    .forEach(async donorId => {
      const currentDonor = donorData.filter(donor => donor.donorId === donorId)[0];
      const currentDonorErrors = clinicalMigrationErrors
        .filter(errorRecord => errorRecord.donorId === donorId)
        .map(migrationError => migrationError.errors)
        .flat();

      // todo: fix 'as'
      const currentDonorEntities = currentDonorErrors
        .map(error => error.entityName as ClinicalEntitySchemaNames)
        .filter((entity, index, array) => array.indexOf(entity) === index);

      const currentVersion = await dictionaryManager.instance().getCurrent();

      const revalidatedErrors = currentDonorEntities.map(entityName => {
        return MigrationManager.validateDonorEntityAgainstNewSchema(
          entityName,
          currentVersion,
          currentDonor,
        );
      });
    });

  const end = new Date().getTime() / 1000;
  L.debug(`getDonorSubmissionErrorUpdates took ${end - start}s`);

  return { validDonorIds, validRecords };
};
