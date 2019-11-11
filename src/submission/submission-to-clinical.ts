/**
 * This module is to host the operations that moves submission data
 * to the clinical model, somehow as set of ETL operations.
 */
import { DeepReadonly } from 'deep-freeze';
import { Donor, Specimen, Sample, SchemaMetadata } from '../clinical/clinical-entities';
import {
  ActiveClinicalSubmission,
  ActiveSubmissionIdentifier,
  ClinicalSubmissionModifierCommand,
  CommitRegistrationCommand,
  ActiveRegistration,
  SubmittedRegistrationRecord,
  FieldsEnum,
  SUBMISSION_STATE,
} from './submission-entities';

import { Errors } from '../utils';
import { donorDao } from '../clinical/donor-repo';
import _ from 'lodash';
import { F } from '../utils';
import { registrationRepository } from './registration-repo';
import { submissionRepository } from './submission-repo';
import { mergeActiveSubmissionWithDonors } from './merge-submission';

/**
 * This method will move the current submitted clinical data to
 * the clinical database
 *
 * @param command CommitClinicalSubmissionCommand with the versionId of the registration to close
 */
export const commitClinicalSubmission = async (
  command: Readonly<ClinicalSubmissionModifierCommand>,
) => {
  // Get active submission
  const activeSubmission = await submissionRepository.findByProgramId(command.programId);

  if (activeSubmission === undefined) {
    throw new Errors.NotFound('No active submission data found for this program.');
  } else if (activeSubmission.version !== command.versionId) {
    throw new Errors.InvalidArgument(
      'Version ID provided does not match the latest submission version for this program.',
    );
  } else if (activeSubmission.state !== SUBMISSION_STATE.VALID) {
    // confirm that the state is VALID
    throw new Errors.StateConflict(
      'Active submission does not have state VALID and cannot be committed.',
    );
  } else {
    // We Did It! We have a valid active submission to commit! Everyone cheers!

    // check if there are updates, if so, change state to SUBMISSION_STATE.PENDING_APPROVAL and save
    if (isPendingApproval(activeSubmission)) {
      // insert into database
      const updated = await submissionRepository.updateSubmissionStateWithVersion(
        command.programId,
        command.versionId,
        command.updater,
        SUBMISSION_STATE.PENDING_APPROVAL,
      );
      return updated;
    } else {
      await performCommitSubmission(activeSubmission);
      return {};
    }
  }
};

function isPendingApproval(activeSubmission: DeepReadonly<ActiveClinicalSubmission>): boolean {
  for (const clinicalType in activeSubmission.clinicalEntities) {
    if (activeSubmission.clinicalEntities[clinicalType].stats.updated.length > 0) {
      return true;
    }
  }
  return false;
}

export const approveClinicalSubmission = async (command: Readonly<ActiveSubmissionIdentifier>) => {
  // Get active submission
  const activeSubmission = await submissionRepository.findByProgramId(command.programId);

  if (activeSubmission === undefined) {
    throw new Errors.NotFound('No active submission data found for this program.');
  } else if (activeSubmission.version !== command.versionId) {
    throw new Errors.InvalidArgument(
      'Version ID provided does not match the latest submission version for this program.',
    );
  } else if (activeSubmission.state !== SUBMISSION_STATE.PENDING_APPROVAL) {
    // confirm that the state is VALID
    throw new Errors.StateConflict(
      'Active submission does not have state PENDING_APPROVAL and cannot be committed.',
    );
  } else {
    // We Did It! We have a valid active submission to commit! Everyone cheers!
    await performCommitSubmission(activeSubmission);
  }
};

const performCommitSubmission = async (
  activeSubmission: DeepReadonly<ActiveClinicalSubmission>,
) => {
  // Get all the current donor documents
  const donorDTOs = await getDonorDTOsForActiveSubmission(activeSubmission);
  if (donorDTOs === undefined || _.isEmpty(donorDTOs)) {
    throw new Errors.StateConflict(
      'Donors for this submission cannot be found in the clinical database.',
    );
  } else {
    // Update with all relevant records
    const updatedDonorDTOs = await mergeActiveSubmissionWithDonors(activeSubmission, donorDTOs);

    try {
      // write each updated donor to the db
      await donorDao.updateAll(updatedDonorDTOs.map(dto => F(dto)));

      // If the save completed without error, we can delete the active registration
      submissionRepository.deleteByProgramId(activeSubmission.programId);
    } catch (err) {
      throw new Error(`Failure occured saving clinical data: ${err}`);
    }
  }
};

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
    registration,
  );

  for (const dto of donorSampleDtos) {
    const existingDonor = await donorDao.findByProgramAndSubmitterId([
      { programId: dto.programId, submitterId: dto.submitterId },
    ]);
    if (existingDonor && existingDonor.length > 0) {
      const mergedDonor = addSamplesToDonor(existingDonor[0], dto);
      const saved = await donorDao.update(mergedDonor);
      continue;
    }
    const saved = await donorDao.create(fromCreateDonorDtoToDonor(dto));
  }

  registrationRepository.delete(command.registrationId);
  return (
    (registration.stats &&
      registration.stats.newSampleIds &&
      registration.stats.newSampleIds.map(s => s.submitterId)) ||
    []
  );
};

const fromCreateDonorDtoToDonor = (createDonorDto: DeepReadonly<CreateDonorSampleDto>) => {
  const donor: Donor = {
    schemaMetadata: createDonorDto.schemaMetadata,
    gender: createDonorDto.gender,
    submitterId: createDonorDto.submitterId,
    programId: createDonorDto.programId,
    specimens: createDonorDto.specimens.map(toSpecimen),
    clinicalInfo: {},
    primaryDiagnosis: {},
    followUps: [],
    treatments: [],
    chemotherapy: [],
    hormoneTherapy: [],
  };
  return donor;
};

const toSpecimen = (s: DeepReadonly<CreateSpecimenDto>) => {
  const spec: Specimen = {
    samples: s.samples.map(toSample),
    clinicalInfo: {},
    specimenTissueSource: s.specimenTissueSource,
    tumourNormalDesignation: s.tumourNormalDesignation,
    submitterId: s.submitterId,
  };
  return spec;
};

const toSample = (sa: DeepReadonly<CreateSampleDto>) => {
  const sample: Sample = {
    sampleType: sa.sampleType,
    submitterId: sa.submitterId,
  };
  return sample;
};

const addSamplesToDonor = (
  existingDonor: DeepReadonly<Donor>,
  donorSampleDto: DeepReadonly<CreateDonorSampleDto>,
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
    let donor = donors.find(d => d.submitterId === rec[FieldsEnum.submitter_donor_id]);
    if (!donor) {
      const firstSpecimen = getDonorSpecimen(rec);
      donor = {
        submitterId: rec[FieldsEnum.submitter_donor_id],
        gender: rec[FieldsEnum.gender],
        programId: registration.programId,
        specimens: [firstSpecimen],
        schemaMetadata: {
          currentSchemaVersion: registration.schemaVersion,
          isValid: true,
          lastMigrationId: undefined,
          originalSchemaVersion: registration.schemaVersion,
        },
      };
      donors.push(donor);
      return;
    }

    // if the specimen doesn't exist add it
    let specimen = donor.specimens.find(
      s => s.submitterId === rec[FieldsEnum.submitter_specimen_id],
    );
    if (!specimen) {
      specimen = getDonorSpecimen(rec);
      donor.specimens.push(specimen);
    } else {
      specimen.samples.push({
        sampleType: rec[FieldsEnum.sample_type],
        submitterId: rec[FieldsEnum.submitter_sample_id],
      });
    }
  });
  return F(donors);
};

const getDonorIdsInActiveSubmission = (
  activeSubmission: DeepReadonly<ActiveClinicalSubmission>,
) => {
  const donorIds: Set<string> = new Set();
  for (const entityType in activeSubmission.clinicalEntities) {
    const entities = activeSubmission.clinicalEntities[entityType];
    entities.records.forEach(record => donorIds.add(record.submitter_donor_id));
  }

  return donorIds;
};

const getDonorDTOsForActiveSubmission = async (
  activeSubmission: DeepReadonly<ActiveClinicalSubmission>,
) => {
  // Get the unique Donor IDs to update
  const donorIds = getDonorIdsInActiveSubmission(activeSubmission);

  // Get the donor records for each ID
  const daoFilters = Array.from(donorIds.values()).map(submitterId => ({
    programId: activeSubmission.programId,
    submitterId,
  }));
  const donors = await donorDao.findByProgramAndSubmitterId(daoFilters);

  return donors;
};

const getDonorSpecimen = (record: SubmittedRegistrationRecord) => {
  return {
    specimenTissueSource: record[FieldsEnum.specimen_tissue_source],
    tumourNormalDesignation: record[FieldsEnum.tumour_normal_designation],
    submitterId: record[FieldsEnum.submitter_specimen_id],
    samples: [
      {
        sampleType: record[FieldsEnum.sample_type],
        submitterId: record[FieldsEnum.submitter_sample_id],
      },
    ],
  };
};

export interface CreateDonorSampleDto {
  gender: string;
  submitterId: string;
  programId: string;
  specimens: Array<CreateSpecimenDto>;
  schemaMetadata: SchemaMetadata;
}

export interface CreateSpecimenDto {
  samples: Array<CreateSampleDto>;
  specimenTissueSource: string;
  tumourNormalDesignation: string;
  submitterId: string;
}

export interface CreateSampleDto {
  sampleType: string;
  submitterId: string;
}
