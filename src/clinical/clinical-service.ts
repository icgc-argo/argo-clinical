import { donorDao } from './donor-repo';
import { Errors } from '../utils';
import { Sample } from './clinical-entities';

export async function getDonors(programId: string) {
  return await donorDao.findByProgramId(programId);
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
