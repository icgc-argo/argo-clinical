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

/**
 * This module is to host the operations that moves submission data
 * to the clinical model, somehow as set of ETL operations.
 */
import { DeepReadonly } from 'deep-freeze';
import { Donor, Specimen, Sample, SchemaMetadata } from '../../clinical/clinical-entities';
import {
  ActiveClinicalSubmission,
  ActiveSubmissionIdentifier,
  ClinicalSubmissionModifierCommand,
  CommitRegistrationCommand,
  ActiveRegistration,
  SubmittedRegistrationRecord,
  SampleRegistrationFieldsEnum,
  SUBMISSION_STATE,
} from '../submission-entities';
import { DonorUtils, Errors } from '../../utils';
import {
  donorDao,
  FindByProgramAndSubmitterFilter,
  DONOR_DOCUMENT_FIELDS,
} from '../../clinical/donor-repo';
import _ from 'lodash';
import { F } from '../../utils';
import { registrationRepository } from '../registration-repo';
import { submissionRepository } from '../submission-repo';
import { mergeActiveSubmissionWithDonors } from './merge-submission';
import * as dictionaryManager from '../../dictionary/manager';
import { loggerFor } from '../../logger';
const L = loggerFor(__filename);
import {
  updateDonorStatsFromRegistrationCommit,
  recalculateDonorStatsHoldOverridden,
} from './stat-calculator';
import * as messenger from '../submission-updates-messenger';

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
  }

  // Update with all relevant records
  const updatedDonorDTOs = await mergeActiveSubmissionWithDonors(activeSubmission, donorDTOs);

  const verifiedDonorDTOs: Donor[] = [];
  // check donor if was invalid against current dictionary
  const currentDictionary = await dictionaryManager.instance().getCurrent();
  updatedDonorDTOs.forEach(ud => {
    if (ud.schemaMetadata.isValid === false) {
      L.debug('Donor is invalid, revalidating if valid now');
      const isValid = dictionaryManager.revalidateAllDonorClinicalEntitiesAgainstSchema(
        ud,
        currentDictionary,
      );
      if (isValid) {
        L.info(`donor ${ud._id} is now valid`);
        ud.schemaMetadata.isValid = true;
        ud.schemaMetadata.lastValidSchemaVersion = currentDictionary.version;
      }
    }
    // recalculate the donors stats
    verifiedDonorDTOs.push(recalculateDonorStatsHoldOverridden(ud));
  });

  try {
    // write each updated donor to the db
    await donorDao.updateAll(verifiedDonorDTOs.map(dto => F(dto)));

    // If the save completed without error, we can delete the active registration
    submissionRepository.deleteByProgramId(activeSubmission.programId);

    sendMessageOnUpdatesFromClinicalSubmission(activeSubmission);
  } catch (err) {
    throw new Error(`Failure occured saving clinical data: ${err}`);
  }
};

/**
 * This method will move the registered donor document to donor collection
 * and remove it from active registration collection.
 *
 * @param command CommitRegistrationCommand the id of the registration to close.
 */
export const commitRegistration = async (command: Readonly<CommitRegistrationCommand>) => {
  const registration = await registrationRepository.findById(command.registrationId);

  if (registration === undefined || registration.programId !== command.programId) {
    throw new Errors.NotFound(`no registration with id :${command.registrationId} found`);
  }

  const donorSampleDtos: DeepReadonly<CreateDonorSampleDto[]> = mapToCreateDonorSampleDto(
    registration,
  );

  const filters = new Array<FindByProgramAndSubmitterFilter>();

  for (const dto of donorSampleDtos) {
    filters.push({ programId: dto.programId, submitterId: dto.submitterId });
  }

  // batch fetch existing donors from db
  const existingDonors = (await donorDao.findByProgramAndSubmitterId(filters)) || [];
  const existingDonorsIds = _.keyBy(existingDonors, DONOR_DOCUMENT_FIELDS.SUBMITTER_ID);

  // Performance refactor Note:
  // instead of awaiting to save donor documents one by one we batch the saving queries and await on the whole batch
  // AND since each donor document is isolated and only occur once in the collection
  // and our sequential id generation is atomic it's safe to do so.
  const DOCUMENTS_PER_BATCH = 200;
  const totalBatches = Math.ceil(donorSampleDtos.length / DOCUMENTS_PER_BATCH);
  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    await Promise.all(
      updateOrCreateDonorsBatch(batchNum, donorSampleDtos, existingDonorsIds, DOCUMENTS_PER_BATCH),
    );
  }
  registrationRepository.delete(command.registrationId);
  sendMessageOnUpdatesFromRegistration(registration);
  return (
    (registration.stats &&
      registration.stats.newSampleIds &&
      registration.stats.newSampleIds.map(s => s.submitterId)) ||
    []
  );
};

const updateOrCreateDonorsBatch = (
  batchNumber: number,
  donorSampleDtos: DeepReadonly<CreateDonorSampleDto[]>,
  existingDonorsIds: _.Dictionary<DeepReadonly<Donor>>,
  batchSize: number,
) => {
  const donorsBatch = _(donorSampleDtos)
    .slice(batchNumber * batchSize)
    .take(batchSize)
    .value();
  return donorsBatch.map(dto => {
    if (existingDonorsIds[dto.submitterId]) {
      const mergedDonor = addSamplesToDonor(existingDonorsIds[dto.submitterId], dto);
      const statUpdatedDonor = updateDonorStatsFromRegistrationCommit(mergedDonor);
      return donorDao.update(statUpdatedDonor);
    }
    return donorDao.create(fromCreateDonorDtoToDonor(dto));
  });
};

const fromCreateDonorDtoToDonor = (createDonorDto: DeepReadonly<CreateDonorSampleDto>) => {
  const donor: Donor = {
    schemaMetadata: createDonorDto.schemaMetadata,
    gender: createDonorDto.gender,
    submitterId: createDonorDto.submitterId,
    programId: createDonorDto.programId,
    specimens: createDonorDto.specimens.map(toSpecimen),
    clinicalInfo: {},
    primaryDiagnoses: undefined,
    familyHistory: undefined,
    followUps: [],
    treatments: [],
  };
  return donor;
};

const toSpecimen = (s: DeepReadonly<CreateSpecimenDto>) => {
  const spec: Specimen = {
    samples: s.samples.map(toSample),
    clinicalInfo: {},
    specimenTissueSource: s.specimenTissueSource,
    tumourNormalDesignation: s.tumourNormalDesignation,
    specimenType: s.specimenType,
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
    let donor = donors.find(
      d => d.submitterId === rec[SampleRegistrationFieldsEnum.submitter_donor_id],
    );
    if (!donor) {
      const firstSpecimen = getDonorSpecimen(rec);
      donor = {
        submitterId: rec[SampleRegistrationFieldsEnum.submitter_donor_id],
        gender: rec[SampleRegistrationFieldsEnum.gender],
        programId: registration.programId,
        specimens: [firstSpecimen],
        schemaMetadata: {
          lastValidSchemaVersion: registration.schemaVersion,
          isValid: true,
          originalSchemaVersion: registration.schemaVersion,
        },
      };
      donors.push(donor);
      return;
    }

    // if the specimen doesn't exist add it
    let specimen = donor.specimens.find(
      s => s.submitterId === rec[SampleRegistrationFieldsEnum.submitter_specimen_id],
    );
    if (!specimen) {
      specimen = getDonorSpecimen(rec);
      donor.specimens.push(specimen);
    } else {
      specimen.samples.push({
        sampleType: rec[SampleRegistrationFieldsEnum.sample_type],
        submitterId: rec[SampleRegistrationFieldsEnum.submitter_sample_id],
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
    specimenTissueSource: record[SampleRegistrationFieldsEnum.specimen_tissue_source],
    tumourNormalDesignation: record[SampleRegistrationFieldsEnum.tumour_normal_designation],
    specimenType: record[SampleRegistrationFieldsEnum.specimen_type],
    submitterId: record[SampleRegistrationFieldsEnum.submitter_specimen_id],
    samples: [
      {
        sampleType: record[SampleRegistrationFieldsEnum.sample_type],
        submitterId: record[SampleRegistrationFieldsEnum.submitter_sample_id],
      },
    ],
  };
};

const sendMessageOnUpdatesFromRegistration = async (
  registration: DeepReadonly<ActiveRegistration>,
) => {
  if (
    registration.stats.newDonorIds.length > 0 ||
    registration.stats.newSampleIds.length > 0 ||
    registration.stats.newSpecimenIds.length > 0
  ) {
    // use donor model to fetch donorIds for new donors from their submitterIds
    const programId = registration.programId;
    const submitterIds = registration.stats.newDonorIds.map(id => id?.submitterId);
    const donors = await donorDao.findByProgramAndSubmitterIds(programId, submitterIds);
    const donorIds = donors ? donors.filter(d => d.donorId).map(d => String(d.donorId)) : [];

    await messenger.getInstance().sendProgramUpdatedMessage({ programId, donorIds });
  }
};

const sendMessageOnUpdatesFromClinicalSubmission = async (
  submission: DeepReadonly<ActiveClinicalSubmission>,
) => {
  // just making sure submission is in correct state
  if (
    submission.state !== SUBMISSION_STATE.VALID &&
    submission.state !== SUBMISSION_STATE.PENDING_APPROVAL
  ) {
    throw new Error("Can't send messages for submission which are not valid or pending_approval");
  }

  const submissionHasProgramUpdates =
    submission.state === SUBMISSION_STATE.PENDING_APPROVAL ||
    Object.entries(submission.clinicalEntities).some(
      ([_, entity]) => entity.stats.new.length > 0 || entity.stats.updated.length > 0,
    );

  if (submissionHasProgramUpdates) {
    // use model to fetch donorIds for updated donors from their donorSubmitterIds
    const programId = submission.programId;
    const donorSubmitterIds = Object.entries(submission.clinicalEntities)
      .filter(([_, entity]) => entity.stats.new.length > 0 || entity.stats.updated.length > 0)
      .map(([_, entity]) => entity.dataUpdates.map(update => update.info.donorSubmitterId))
      .reduce((acc, curr) => acc.concat(curr), []);
    const donors = await donorDao.findByProgramAndSubmitterIds(programId, donorSubmitterIds);
    const donorIds = donors
      ? donors.filter(d => d.donorId).map(d => DonorUtils.prefixDonorId(d.donorId as number))
      : [];

    await messenger.getInstance().sendProgramUpdatedMessage({ programId, donorIds });
  }
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
  specimenType: string;
  submitterId: string;
}

export interface CreateSampleDto {
  sampleType: string;
  submitterId: string;
}
