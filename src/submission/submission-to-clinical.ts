/**
 * This module is to host the operations that moves submission data
 * to the clinical model, somehow as set of ETL operations.
 */
import { DeepReadonly } from "deep-freeze";
import { Donor, Specimen, Sample } from "../clinical/clinical-entities";
import {
  CommitRegistrationCommand,
  ActiveRegistration,
  SubmittedRegistrationRecord,
  RegistrationFieldsEnum
} from "./submission-entities";

import { Errors } from "../utils";
import { donorDao } from "../clinical/donor-repo";
import _ from "lodash";
import { F } from "../utils";
import { registrationRepository } from "./registration-repo";

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

  const donorSampleDtos: DeepReadonly<CreateDonorSampleDto[]> = mapToCreateDonorSampleDto(
    registration
  );

  for (const dto of donorSampleDtos) {
    const existingDonor = await donorDao.findByProgramAndSubmitterId([
      { programId: dto.programId, submitterId: dto.submitterId }
    ]);
    if (existingDonor && existingDonor.length > 0) {
      const mergedDonor = addSamplesToDonor(existingDonor[0], dto);
      const saved = await donorDao.update(mergedDonor);
      continue;
    }
    const saved = await donorDao.create(fromCreateDonorDtoToDonor(dto));
  }

  registrationRepository.delete(command.registrationId);
  return registration.stats.newSampleIds;
};

const fromCreateDonorDtoToDonor = (createDonorDto: DeepReadonly<CreateDonorSampleDto>) => {
  const donor: Donor = {
    gender: createDonorDto.gender,
    submitterId: createDonorDto.submitterId,
    programId: createDonorDto.programId,
    specimens: createDonorDto.specimens.map(toSpecimen),
    clinicalInfo: {},
    primaryDiagnosis: {},
    followUps: [],
    treatments: [],
    chemotherapy: [],
    HormoneTherapy: []
  };
  return donor;
};

const toSpecimen = (s: DeepReadonly<CreateSpecimenDto>) => {
  const spec: Specimen = {
    samples: s.samples.map(toSample),
    clinicalInfo: {},
    specimenType: s.specimenType,
    tumourNormalDesignation: s.tumourNormalDesignation,
    submitterId: s.submitterId
  };
  return spec;
};

const toSample = (sa: DeepReadonly<CreateSampleDto>) => {
  const sample: Sample = {
    sampleType: sa.sampleType,
    submitterId: sa.submitterId
  };
  return sample;
};

const addSamplesToDonor = (
  existingDonor: DeepReadonly<Donor>,
  donorSampleDto: DeepReadonly<CreateDonorSampleDto>
) => {
  const mergedDonor = _.cloneDeep(existingDonor) as Donor;
  donorSampleDto.specimens.forEach(sp => {
    // new specimen ? add it with all the samples
    const specimen = mergedDonor.specimens.find(s => s.submitterId == sp.submitterId);
    if (!specimen) {
      mergedDonor.specimens.push(toSpecimen(sp));
      return;
    }

    sp.samples.forEach(sa => {
      // new sample ? add it to the specimen
      if (!specimen.samples.find(s => s.submitterId === sa.submitterId)) {
        specimen.samples.push(toSample(sa));
      }
    });
  });
  return F(mergedDonor);
};

const mapToCreateDonorSampleDto = (registration: DeepReadonly<ActiveRegistration>) => {
  const donors: CreateDonorSampleDto[] = [];
  registration.records.forEach(rec => {
    // if the donor doesn't exist add it
    let donor = donors.find(d => d.submitterId === rec[RegistrationFieldsEnum.submitter_donor_id]);
    if (!donor) {
      const firstSpecimen = getDonorSpecimen(rec);
      donor = {
        submitterId: rec[RegistrationFieldsEnum.submitter_donor_id],
        gender: rec[RegistrationFieldsEnum.gender],
        programId: registration.programId,
        specimens: [firstSpecimen]
      };
      donors.push(donor);
      return;
    }

    // if the specimen doesn't exist add it
    let specimen = donor.specimens.find(
      s => s.submitterId === rec[RegistrationFieldsEnum.submitter_specimen_id]
    );
    if (!specimen) {
      specimen = getDonorSpecimen(rec);
      donor.specimens.push(specimen);
    } else {
      specimen.samples.push({
        sampleType: rec[RegistrationFieldsEnum.sample_type],
        submitterId: rec[RegistrationFieldsEnum.submitter_sample_id]
      });
    }
  });
  return F(donors);
};

const getDonorSpecimen = (record: SubmittedRegistrationRecord) => {
  return {
    specimenType: record[RegistrationFieldsEnum.specimen_type],
    tumourNormalDesignation: record[RegistrationFieldsEnum.tumour_normal_designation],
    submitterId: record[RegistrationFieldsEnum.submitter_specimen_id],
    samples: [
      {
        sampleType: record[RegistrationFieldsEnum.sample_type],
        submitterId: record[RegistrationFieldsEnum.submitter_sample_id]
      }
    ]
  };
};

export interface CreateDonorSampleDto {
  gender: string;
  submitterId: string;
  programId: string;
  specimens: Array<CreateSpecimenDto>;
}

export interface CreateSpecimenDto {
  samples: Array<CreateSampleDto>;
  specimenType: string;
  tumourNormalDesignation: string;
  submitterId: string;
}

export interface CreateSampleDto {
  sampleType: string;
  submitterId: string;
}
