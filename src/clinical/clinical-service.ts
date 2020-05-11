import { donorDao, DONOR_FIELDS } from './donor-repo';
import { Errors, notEmpty } from '../utils';
import { Sample, Donor } from './clinical-entities';
import { DeepReadonly } from 'deep-freeze';
import _, { isEmpty } from 'lodash';
import { forceRecalcDonorCoreEntityStats } from '../submission/submission-to-clinical/stat-calculator';
import { ClinicalEntitySchemaNames } from '../common-model/entities';
import { getClinicalEntitiesFromDonorBySchemaName } from '../common-model/functions';
import * as dictionaryManager from '../dictionary/manager';
import { loggerFor } from '../logger';

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
        { [DONOR_FIELDS.LAST_MIGRATION_ID]: { $ne: migrationId } },
        { [DONOR_FIELDS.LAST_MIGRATION_ID]: undefined },
        { [DONOR_FIELDS.LAST_MIGRATION_ID]: { $exists: false } },
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

export async function getClinicalData(programId: string) {
  if (!programId) throw new Error('Missing programId!');

  const start = new Date().getTime() / 1000;

  const donors = await getDonors(programId);

  // collect all records
  const recordsMap: any = {};
  donors.forEach(d => {
    Object.values(ClinicalEntitySchemaNames).forEach(entity => {
      let clincialInfoRecords;
      if (entity === ClinicalEntitySchemaNames.REGISTRATION) {
        clincialInfoRecords = generateSampleRegistrationDataForDonor(d);
      } else {
        clincialInfoRecords = getClinicalEntitiesFromDonorBySchemaName(d, entity);
      }
      recordsMap[entity] = _.concat(recordsMap[entity] || [], clincialInfoRecords);
    });
  });

  // map into object ready for api processing
  const schemasWithFields = dictionaryManager.instance().getSchemasWithFields();
  const data = Object.entries(recordsMap)
    .map(([entityName, records]) => {
      if (isEmpty(records)) return undefined;

      const relevantSchemaWithFields = schemasWithFields.find(s => s.name === entityName);
      if (!relevantSchemaWithFields) {
        throw new Error(`Can't find schema ${entityName}, something is wrong here!`);
      }

      return {
        entityName,
        records,
        entityFields: relevantSchemaWithFields.fields,
      };
    })
    .filter(notEmpty);

  const end = new Date().getTime() / 1000;
  L.info(`getClinicalData took ${end - start}s`);

  return data;
}

function generateSampleRegistrationDataForDonor(d: DeepReadonly<Donor>) {
  const baseRegistrationRecord = {
    program_id: d.programId,
    submitter_donor_id: d.submitterId,
    gender: d.gender,
  };

  return d.specimens
    .map(sp =>
      sp.samples.map(sm => ({
        ...baseRegistrationRecord,
        submitter_specimen_id: sp.submitterId,
        specimen_tissue_source: sp.specimenTissueSource,
        tumour_normal_designation: sp.tumourNormalDesignation,
        specimen_type: sp.specimenType,
        submitter_sample_id: sm.submitterId,
        sample_type: sm.sampleType,
      })),
    )
    .flat();
}
