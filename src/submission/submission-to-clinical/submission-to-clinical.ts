/*
 * Copyright (c) 2024 The Ontario Institute for Cancer Research. All rights reserved
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
import _ from 'lodash';
import { Donor, Sample, SchemaMetadata, Specimen } from '../../clinical/clinical-entities';
import { FindByProgramAndSubmitterFilter, donorDao } from '../../clinical/donor-repo';
import { loggerFor } from '../../logger';
import { DonorUtils, Errors, F } from '../../utils';
import { registrationRepository } from '../registration-repo';
import {
	ActiveClinicalSubmission,
	ActiveRegistration,
	ActiveSubmissionIdentifier,
	ClinicalSubmissionModifierCommand,
	CommitRegistrationCommand,
	SUBMISSION_STATE,
	SampleRegistrationFieldsEnum,
	SubmittedRegistrationRecord,
} from '../submission-entities';
import { submissionRepository } from '../submission-repo';
import * as messenger from '../submission-updates-messenger';
import { mergeActiveSubmissionWithDonors } from './merge-submission';
import { updateDonorsCompletionStats } from './stat-calculator';
import { validateDonorsWithCurrentDictionary } from './validate-donors';
const L = loggerFor(__filename);

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
			return {} as DeepReadonly<ActiveClinicalSubmission>;
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

	// Update donors with submission data
	//  1. merge submission data into donor documents
	//  2. validate updated donors vs current schema
	//  3. recalculate donors core complete stats
	const mergedDonors = await mergeActiveSubmissionWithDonors(activeSubmission, donorDTOs);
	const donorsWithSchemaValidation = await validateDonorsWithCurrentDictionary(mergedDonors);
	const updatedDonors = await updateDonorsCompletionStats(donorsWithSchemaValidation);

	try {
		// write each updated donor to the db
		await donorDao.updateAll(updatedDonors);

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
export const commitRegistration = async (
	command: Readonly<CommitRegistrationCommand>,
): Promise<string[]> => {
	const registration = await registrationRepository.findById(command.registrationId);

	if (registration === undefined || registration.programId !== command.programId) {
		throw new Errors.NotFound(`no registration with id :${command.registrationId} found`);
	}

	const donorSampleDtos = mapToCreateDonorSampleDto(registration);

	const filters: FindByProgramAndSubmitterFilter[] = donorSampleDtos.map((dto) => ({
		programId: dto.programId,
		submitterId: dto.submitterId,
	}));

	// batch fetch existing donors from db
	const existingDonors = (await donorDao.findByProgramAndSubmitterId(filters)) || [];

	const existingDonorsDictionary = existingDonors.reduce<Map<string, DeepReadonly<Donor>>>(
		(map, donor) => {
			map.set(donor.submitterId, donor);
			return map;
		},
		new Map(),
	);

	await updateOrCreateDonors(donorSampleDtos, existingDonorsDictionary);
	registrationRepository.delete(command.registrationId);
	sendMessageOnUpdatesFromRegistration(registration);

	return (
		(registration?.stats?.newSampleIds &&
			registration.stats.newSampleIds.map((s) => s.submitterId)) ||
		[]
	);
};

const updateOrCreateDonors = async (
	donorSampleDtos: DeepReadonly<CreateDonorSampleDto[]>,
	existingDonorsIds: Map<string, DeepReadonly<Donor>>,
) => {
	const samplePairs = donorSampleDtos.map((dto) => ({
		sampleDto: dto,
		existingDonor: existingDonorsIds.get(dto.submitterId),
	}));

	const samplesWithDonor = samplePairs.filter(
		(
			pair,
		): pair is {
			sampleDto: DeepReadonly<CreateDonorSampleDto>;
			existingDonor: DeepReadonly<Donor>;
		} => pair.existingDonor !== undefined,
	);

	const samplesWithoutDonor = samplePairs.filter(
		(
			pair,
		): pair is {
			sampleDto: DeepReadonly<CreateDonorSampleDto>;
			existingDonor: undefined;
		} => pair.existingDonor === undefined,
	);

	// Process samples with existing donor data
	const mergedDonors = samplesWithDonor.map((pair) =>
		addSamplesToDonor(pair.existingDonor, pair.sampleDto),
	);
	// recalculate completion stats for donors
	const recalculatedDonors = await updateDonorsCompletionStats(mergedDonors);
	await Promise.all(recalculatedDonors.map((donor) => donorDao.update(donor)));

	// Process new samples (no existing donor data)
	await Promise.all(
		samplesWithoutDonor.map((pair) => donorDao.create(fromCreateDonorDtoToDonor(pair.sampleDto))),
	);
};

const fromCreateDonorDtoToDonor = (createDonorDto: DeepReadonly<CreateDonorSampleDto>) => {
	const donor: Partial<Donor> = {
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
	donorSampleDto.specimens.forEach((sp) => {
		// new specimen ? add it with all the samples
		const specimen = mergedDonor.specimens.find((s) => s.submitterId == sp.submitterId);
		if (!specimen) {
			mergedDonor.specimens.push(toSpecimen(sp));
			return;
		}

		sp.samples.forEach((sa) => {
			// new sample ? add it to the specimen
			if (!specimen.samples.find((s) => s.submitterId === sa.submitterId)) {
				specimen.samples.push(toSample(sa));
			}
		});
	});
	return F(mergedDonor);
};

const mapToCreateDonorSampleDto = (registration: DeepReadonly<ActiveRegistration>) => {
	const donors: CreateDonorSampleDto[] = [];
	registration.records.forEach((rec) => {
		// if the donor doesn't exist add it
		let donor = donors.find(
			(d) => d.submitterId === rec[SampleRegistrationFieldsEnum.submitter_donor_id],
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
			(s) => s.submitterId === rec[SampleRegistrationFieldsEnum.submitter_specimen_id],
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
		entities.records.forEach((record) => donorIds.add(record.submitter_donor_id));
	}

	return donorIds;
};

const getDonorDTOsForActiveSubmission = async (
	activeSubmission: DeepReadonly<ActiveClinicalSubmission>,
) => {
	// Get the unique Donor IDs to update
	const donorIds = getDonorIdsInActiveSubmission(activeSubmission);

	// Get the donor records for each ID
	const daoFilters = Array.from(donorIds.values()).map((submitterId) => ({
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
		const submitterIds = registration.stats.newDonorIds.map((id) => id?.submitterId);
		const donors = await donorDao.findByProgramAndSubmitterIds(programId, submitterIds);
		const donorIds = donors ? donors.filter((d) => d.donorId).map((d) => String(d.donorId)) : [];

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
			.map(([_, entity]) => entity.dataUpdates.map((update) => update.info.donorSubmitterId))
			.reduce((acc, curr) => acc.concat(curr), []);
		const donors = await donorDao.findByProgramAndSubmitterIds(programId, donorSubmitterIds);
		const donorIds = donors
			? donors.filter((d) => d.donorId).map((d) => DonorUtils.prefixDonorId(d.donorId as number))
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
