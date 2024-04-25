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

import {
	entities as dictionaryEntities,
	functions as dictionaryService,
} from '@overturebio-stack/lectern-client';
import { DeepReadonly } from 'deep-freeze';
import _ from 'lodash';
import {
	ClinicalEntityErrorRecord,
	ClinicalEntitySchemaNames,
	ClinicalErrorsResponseRecord,
	EntityAlias,
	aliasEntityNames,
	allEntityNames,
} from '../common-model/entities';
import {
	filterDuplicates,
	getClinicalEntitiesFromDonorBySchemaName,
} from '../common-model/functions';
import * as dictionaryManager from '../dictionary/manager';
import { schemaRepo } from '../dictionary/repo';
import { schemaFilter } from '../exception/property-exceptions/validation';
import featureFlags from '../feature-flags';
import { loggerFor } from '../logger';
import { checkForProgramAndEntityExceptions } from '../submission/exceptions/exceptions';
import {
	DictionaryMigration,
	DonorMigrationError,
} from '../submission/migration/migration-entities';
import { migrationRepo } from '../submission/migration/migration-repo';
import { prepareForSchemaReProcessing } from '../submission/submission-service';
import { Errors, notEmpty } from '../utils';
import { ClinicalEntityData, Donor, Sample } from './clinical-entities';
import { DONOR_DOCUMENT_FIELDS, donorDao } from './donor-repo';
import { runTaskInWorkerThread } from './service-worker-thread/runner';
import { WorkerTasks } from './service-worker-thread/tasks';
import { CompletionState } from './api/types';

const L = loggerFor(__filename);

// Base type for Clinical Data Queries
export type ClinicalDonorEntityQuery = {
	donorIds: number[];
	submitterDonorIds: string[];
	entityTypes: EntityAlias[];
};

export type PaginationQuery = {
	page: number;
	pageSize?: number;
	sort: string;
};

type ClinicalDataPaginatedQuery = ClinicalDonorEntityQuery & PaginationQuery;

export type ClinicalDataQuery = ClinicalDataPaginatedQuery & {
	completionState?: {};
};

// GQL Query Arguments
// Submitted Data Table, SearchBar, Sidebar, etc.
export type ClinicalDataApiFilters = ClinicalDataPaginatedQuery & {
	completionState?: CompletionState;
};

export type ClinicalDataVariables = {
	programShortName: string;
	filters: ClinicalDataApiFilters;
};

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

export async function getDonorsByIds(donorIds: number[]) {
	return donorDao.findByDonorIds(donorIds);
}

export async function findDonorsBySubmitterIds(programId: string, submitterIds: string[]) {
	return await donorDao.findByProgramAndSubmitterIds(programId, submitterIds);
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
	const specimen = donor.specimens.find((sp) => sp.submitterId == submitterId);
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

export const getPaginatedClinicalData = async (programId: string, query: ClinicalDataQuery) => {
	if (!programId) throw new Error('Missing programId!');

	const allSchemasWithFields = await dictionaryManager.instance().getSchemasWithFields();
	// Get all donors + records for given entity
	const { donors, totalDonors } = await donorDao.findByPaginatedProgramId(programId, query);

	const donorIds = donors.map((donor) => donor.donorId);
	// Todo: Only retrieve if invalidSort
	const { clinicalErrors } = await getClinicalErrors(programId, donorIds);

	const taskToRun = WorkerTasks.ExtractEntityDataFromDonors;
	const taskArgs = [
		donors as Donor[],
		totalDonors,
		allSchemasWithFields,
		query.entityTypes,
		query,
		clinicalErrors,
	];

	// Return paginated data
	const data = await runTaskInWorkerThread<{ clinicalEntities: ClinicalEntityData[] }>(
		taskToRun,
		taskArgs,
	);

	return data;
};

export const getDonorEntityData = async (donorIds: number[]) => {
	const allSchemasWithFields = await dictionaryManager.instance().getSchemasWithFields();
	// Get all donors + records for given entity
	const donors = await getDonorsByIds(donorIds);
	const totalDonors = donors.length;

	const paginationQuery: PaginationQuery = {
		page: 0,
		sort: 'donorId',
	};

	const taskToRun = WorkerTasks.ExtractEntityDataFromDonors;
	const taskArgs = [donors, totalDonors, allSchemasWithFields, allEntityNames, paginationQuery];

	// Return paginated data
	const data = await runTaskInWorkerThread<{ clinicalEntities: ClinicalEntityData[] }>(
		taskToRun,
		taskArgs,
	);

	return data.clinicalEntities;
};

export const getClinicalSearchResults = async (
	programId: string,
	query: ClinicalDonorEntityQuery,
) => {
	if (!programId) throw new Error('Missing programId!');
	const start = new Date().getTime() / 1000;

	// Get list of donorIds + submitterDonorIds matching search results
	const { donors } = await donorDao.findByProgramDonorSearch(programId, query);

	const taskToRun = WorkerTasks.FilterDonorIdDataFromSearch;
	const taskArgs = [donors as Donor[], query];
	const data = await runTaskInWorkerThread<{ searchResults: number[]; totalResults: number }>(
		taskToRun,
		taskArgs,
	);

	const end = new Date().getTime() / 1000;
	L.debug(`getPaginatedClinicalData took ${end - start}s`);

	return data;
};

export const getClinicalErrors = async (programId: string, donorIds: number[]) => {
	// 1. Get the migration errors for every donor requested
	const migrationErrors = await getClinicalEntityMigrationErrors(programId, donorIds);

	// 2. Remove from the list all valid donors
	// (Records fixed with Submissions since last Migration, or which match program Exceptions)
	const validPostSubmissionErrors = await filterErrorsWithUpdatesOrExceptions(
		programId,
		migrationErrors,
	);

	return validPostSubmissionErrors;
};

interface DonorMigration extends Omit<DictionaryMigration, 'invalidDonorsErrors'> {
	invalidDonorsErrors: Array<DonorMigrationError>;
}

/**
 * Returns all errors from latest migration
 * Records are formatted for use on front end.
 */
export const getClinicalEntityMigrationErrors = async (
	programId: string,
	queryDonorIds?: number[],
): Promise<{
	migration: DeepReadonly<DonorMigration | undefined>;
	clinicalMigrationErrors: ClinicalErrorsResponseRecord[];
}> => {
	if (!programId) throw new Error('Missing programId!');
	const start = new Date().getTime() / 1000;

	const migration: DeepReadonly<
		DonorMigration | undefined
	> = await migrationRepo.getLatestSuccessful();

	const clinicalMigrationErrors: ClinicalErrorsResponseRecord[] = [];
	if (migration) {
		const { invalidDonorsErrors } = migration;
		const programErrors = invalidDonorsErrors.filter((donor) => donor.programId === programId);
		const queryErrors = programErrors.filter((donorError) =>
			Array.isArray(queryDonorIds) && queryDonorIds.length
				? queryDonorIds.includes(donorError.donorId)
				: true,
		);

		queryErrors.forEach((donor) => {
			const { donorId, submitterDonorId, errors } = donor;
			// Overwrite donor.errors + flatten entityName to simplify query
			// Input: Donor.Errors = [{ [entityName] : [{error}] }]
			// =>  Output: Donor.Errors = [{ ...error, entityName}]

			errors.forEach((errorRecord) => {
				let entityName: ClinicalEntitySchemaNames;
				for (entityName in errorRecord) {
					const entityErrors = errorRecord[entityName];
					if (entityErrors && entityErrors.length > 0) {
						const updatedErrorEntries = entityErrors.map((error) => ({
							...error,
							donorId,
							entityName,
						}));

						const updatedDonorErrorData: ClinicalErrorsResponseRecord = {
							donorId,
							submitterDonorId,
							entityName,
							errors: updatedErrorEntries,
						};

						clinicalMigrationErrors.push(updatedDonorErrorData);
					}
				}
			});
		});
	}

	const end = new Date().getTime() / 1000;
	L.debug(`getClinicalEntityMigrationErrors took ${end - start}s`);

	return { migration, clinicalMigrationErrors };
};

const formatEntityErrorRecord = (
	donorId: number,
	entityName: ClinicalEntitySchemaNames,
	validationRecord: DeepReadonly<dictionaryEntities.SchemaValidationError>,
): ClinicalEntityErrorRecord => ({
	donorId,
	entityName,
	...validationRecord,
});

const revalidateEntityRecords = async (
	programId: string,
	currentDonor: DeepReadonly<Donor>,
	entityName: ClinicalEntitySchemaNames,
	migrationDictionary: dictionaryEntities.SchemasDictionary,
) => {
	const entityRecords = getClinicalEntitiesFromDonorBySchemaName(currentDonor, entityName);

	const stringifiedRecords = entityRecords
		.map((record) => prepareForSchemaReProcessing(record))
		.filter(notEmpty);

	// Revalidate records against Dictionary
	const { validationErrors } = dictionaryService.processRecords(
		migrationDictionary,
		entityName,
		stringifiedRecords,
	);

	const processedErrors = [...validationErrors];

	if (featureFlags.FEATURE_SUBMISSION_EXCEPTIONS_ENABLED) {
		const { schemas } = migrationDictionary;
		// Remove any Errors that match Exceptions
		const entitySchema = schemas.find(schemaFilter(entityName));

		const exceptionErrors = await matchDonorErrorsWithExceptions(
			programId,
			entityName,
			entityRecords,
			processedErrors,
			entitySchema,
		).then((data) => data.flat());

		return exceptionErrors;
	}

	return processedErrors;
};

const getInvalidDonors = async (
	programId: string,
	clinicalMigrationErrors: ClinicalErrorsResponseRecord[],
	errorDonorIds: number[],
) => {
	let errorEntities: ClinicalEntitySchemaNames[] = [];

	clinicalMigrationErrors.forEach((migrationError) => {
		const { errors } = migrationError;
		errors.forEach((error) => {
			const { entityName } = error;
			if (!errorEntities.includes(entityName)) errorEntities = [...errorEntities, entityName];
		});
	});

	const errorQuery: ClinicalDataQuery = {
		page: 0,
		sort: 'donorId',
		entityTypes: ['donor', ...errorEntities.map((schemaName) => aliasEntityNames[schemaName])],
		donorIds: errorDonorIds,
		submitterDonorIds: [],
	};

	const donorData = (await donorDao.findByPaginatedProgramId(programId, errorQuery)).donors;

	return donorData;
};

/**
 * Given a list of Program Migration Errors, this function filters out
 * Errors where the Donor is now Valid, or where the Error matches an Exception value
 */
export const filterErrorsWithUpdatesOrExceptions = async (
	programId: string,
	migrationData: {
		migration: DeepReadonly<DonorMigration | undefined>;
		clinicalMigrationErrors: ClinicalErrorsResponseRecord[];
	},
): Promise<{
	clinicalErrors: ClinicalErrorsResponseRecord[];
}> => {
	if (!programId) throw new Error('Missing programId!');

	const start = new Date().getTime() / 1000;

	const { migration: lastMigration, clinicalMigrationErrors } = migrationData;

	const migrationVersion = lastMigration?.toVersion;

	const schemaName = await dictionaryManager.instance().getCurrentName();

	if (!migrationVersion) {
		L.error(
			`filterErrorsWithUpdatesOrExceptions error finding migration schema, migrationVersion: ${migrationVersion}, schemaName: ${schemaName}`,
			{ migrationVersion, schemaName },
		);
		return { clinicalErrors: clinicalMigrationErrors };
	}

	// Retrieve Migration Dictionary from DB, if not found, request from Lectern and save in DB
	const migrationDictionary = await schemaRepo
		.get(schemaName, {
			requestedVersion: migrationVersion,
		})
		.then(async (dictionary) => {
			if (dictionary) {
				return dictionary;
			} else {
				return await dictionaryManager
					.instance()
					.loadAndSaveNewVersion(schemaName, migrationVersion);
			}
		});

	const errorDonorIds = clinicalMigrationErrors.map((error) => error.donorId);

	// Retrieve All Invalid Donors from previous migration
	const donorData = await getInvalidDonors(programId, clinicalMigrationErrors, errorDonorIds);

	// Filter any Donors that are now Valid
	const validDonorIds = donorData
		.filter((donor) => donor.schemaMetadata.isValid)
		.map(({ donorId }) => donorId);

	const invalidDonorIds = errorDonorIds.filter(
		(donorId, index, array) =>
			!validDonorIds.includes(donorId) && filterDuplicates(donorId, index, array),
	);

	let clinicalErrors: ClinicalErrorsResponseRecord[] = [];

	if (invalidDonorIds.length > 0) {
		const invalidDonorRecords = donorData.filter((donor) =>
			invalidDonorIds.includes(donor.donorId),
		);

		// Filters out any Errors for Donors that are now valid post-submission
		// or which are related to Records which match Program Exceptions
		const validationErrors = await Promise.all(
			// For each invalid donor ...
			invalidDonorRecords.map(async (currentDonor) => {
				const { donorId, submitterId: submitterDonorId } = currentDonor;

				const filteredDisplayErrors: ClinicalErrorsResponseRecord[] = [];

				const entityMigrationErrors: {
					[k in ClinicalEntitySchemaNames]?: ClinicalEntityErrorRecord[];
				} = {};

				const currentDonorErrors = clinicalMigrationErrors.filter(
					(errorRecord) => errorRecord.donorId === donorId,
				);
				// Organize Errors by Entity
				currentDonorErrors.forEach((migrationError) => {
					const { entityName, errors } = migrationError;
					const prevEntityErrors = entityMigrationErrors[entityName];
					if (prevEntityErrors) {
						entityMigrationErrors[entityName] = [...prevEntityErrors, ...errors];
					} else {
						entityMigrationErrors[entityName] = errors;
					}
				});

				// Revalidate current records against related Entity schema and Exceptions
				let entityName: keyof typeof entityMigrationErrors;
				for (entityName in entityMigrationErrors) {
					const filteredErrors = await revalidateEntityRecords(
						programId,
						currentDonor,
						entityName,
						migrationDictionary,
					);

					// Format Filtered Errors for UI
					const errors: ClinicalEntityErrorRecord[] = filteredErrors.map((schemaError) =>
						formatEntityErrorRecord(donorId, entityName, schemaError),
					);

					const errorResponseRecord: ClinicalErrorsResponseRecord = {
						donorId,
						submitterDonorId,
						entityName,
						errors,
					};

					filteredDisplayErrors.push(errorResponseRecord);
				}

				return filteredDisplayErrors;
			}),
		);
		clinicalErrors = validationErrors.flat();
	}

	const end = new Date().getTime() / 1000;
	L.debug(`getDonorSubmissionErrorUpdates took ${end - start}s`);

	return { clinicalErrors };
};

/**
 * Remove from the list all errors which match Program Exceptions
 */
export const matchDonorErrorsWithExceptions = async (
	programId: string,
	schemaName: ClinicalEntitySchemaNames,
	processedRecords: DeepReadonly<dictionaryEntities.TypedDataRecord>[],
	schemaValidationErrors: dictionaryEntities.SchemaValidationError[],
	entitySchema: dictionaryEntities.SchemaDefinition | undefined,
) => {
	const exceptionResults = await Promise.all(
		processedRecords.map(async (record, index) => {
			const validationErrors = schemaValidationErrors.filter((error) => error.index === index);
			const postExceptionRecords = await checkForProgramAndEntityExceptions({
				programId,
				record,
				schemaName,
				validationErrors,
				entitySchema,
			});
			return postExceptionRecords.filteredErrors;
		}),
	);

	return exceptionResults;
};
