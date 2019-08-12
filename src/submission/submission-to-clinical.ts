import { DeepReadonly } from "deep-freeze";
import { Donor } from "../clinical/clinical-entities";
import {
  CommitRegistrationCommand,
  ActiveRegistration,
  SubmittedRegistrationRecord,
  RegistrationStat
} from "./submission-entities";
import { CreateDonorDto } from "../clinical/donor-repo";
import { Errors } from "../utils";
import { donorDao } from "../clinical/donor-repo";
import _ from "lodash";
import { F } from "../utils";
import { registrationRepository } from "./registration-repo";

/**
 * This module is to host the operations that moves submission data
 * to the clinical model, somehow as set of ETL operations.
 */

/**
 * This method will move the registered donor document to donor collection
 * and remove it from active registration collection.
 *
 * @param command CommitRegistrationCommand the id of the registration to close.
 */
export const commitRegisteration = async (command: Readonly<CommitRegistrationCommand>) => {
  const registration = await registrationRepository.findById(command.registrationId);
  if (registration === undefined || registration.programId !== command.programId) {
    throw new Errors.NotFound(`no registration with id :${command.registrationId} found`);
  }

  const donorRecords: DeepReadonly<CreateDonorDto[]> = mapToDonorRecords(registration);
  const savedDonors: Array<DeepReadonly<Donor>> = [];

  for (const rd of donorRecords) {
    const existingDonor = await donorDao.findByProgramAndSubmitterId([
      { programId: rd.programId, submitterId: rd.submitterId }
    ]);
    if (existingDonor && existingDonor.length > 0) {
      const mergedDonor = _.mergeWith(existingDonor[0], rd, (obj, src) => {
        if (_.isArray(obj)) {
          return obj.concat(src);
        }
      }) as Donor;
      const saved = await donorDao.update(mergedDonor);
      savedDonors.push(saved);
      continue;
    }
    const saved = await donorDao.create(rd);
    savedDonors.push(saved);
  }

  registrationRepository.delete(command.registrationId);
  return registration.stats.newSampleIds;
};

const mapToDonorRecords = (registration: DeepReadonly<ActiveRegistration>) => {
  const donors: CreateDonorDto[] = [];
  registration.records.forEach(rec => {
    // if the donor doesn't exist add it
    let donor = donors.find(d => d.submitterId === rec.donor_submitter_id);
    if (!donor) {
      const firstSpecimen = getDonorSpecimen(rec);
      donor = {
        submitterId: rec.donor_submitter_id,
        gender: rec.gender,
        programId: registration.programId,
        specimens: [firstSpecimen]
      };
      donors.push(donor);
      return;
    }

    // if the specimen doesn't exist add it
    let specimen = donor.specimens.find(s => s.submitterId === rec.specimen_submitter_id);
    if (!specimen) {
      specimen = getDonorSpecimen(rec);
      donor.specimens.push(specimen);
    } else {
      specimen.samples.push({
        sampleType: rec.sample_type,
        submitterId: rec.sample_submitter_id
      });
    }
  });
  return F(donors);
};

const getDonorSpecimen = (record: SubmittedRegistrationRecord) => {
  return {
    specimenType: record.specimen_type,
    tumourNormalDesignation: record.tumour_normal_designation,
    submitterId: record.specimen_submitter_id,
    samples: [
      {
        sampleType: record.sample_type,
        submitterId: record.sample_submitter_id
      }
    ]
  };
};
