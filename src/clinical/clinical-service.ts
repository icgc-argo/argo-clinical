import { donorDao, DONOR_DOCUMENT_FIELDS } from './donor-repo';
import { Errors } from '../utils';
import { Sample, Donor } from './clinical-entities';
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
  const donor = await findDonor(submitterId, programId);
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

export async function findDonor(submitterId: string, programId: string) {
  const donors = await donorDao.findByProgramAndSubmitterId([
    {
      programId: programId,
      submitterId: submitterId,
    },
  ]);

  if (!donors || donors.length == 0) {
    return undefined;
  }

  return donors[0];
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

export const getClinicalData = async (programId: string) => {
  if (!programId) throw new Error('Missing programId!');
  const start = new Date().getTime() / 1000;

  // worker-threads can't get dictionary instance so deal with it here and pass it to worker task
  const schemasWithFields = await dictionaryManager.instance().getSchemasWithFields();

  // async/await functions just hang in current library worker-thread setup, root cause is unknown
  const donors = await donorDao.findByProgramId(programId, {}, true);

  const taskToRun = WorkerTasks.ExtractDataFromDonors;
  const taskArgs = [donors, schemasWithFields];
  const data = await runTaskInWorkerThread(taskToRun, taskArgs);

  const end = new Date().getTime() / 1000;
  L.debug(`getClinicalData took ${end - start}s`);

  return data;
};
