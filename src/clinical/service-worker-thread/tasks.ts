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
import _, { isEmpty } from 'lodash';
import {
	ClinicalEntitySchemaNames,
	ClinicalErrorsResponseRecord,
	EntityAlias,
	aliasEntityNames,
} from '../../common-model/entities';
import {
	calculateSpecimenCompletionStats,
	filterHasDnaSample,
	getRequiredDonorFieldsForEntityTypes,
	getClinicalEntitiesFromDonorBySchemaName,
	getClinicalEntitySubmittedData,
	getSampleRegistrationDataFromDonor,
} from '../../common-model/functions';
import { notEmpty } from '../../utils';
import {
	ClinicalDonorEntityQuery,
	ClinicalDataSortType,
	ClinicalDataSortTypes,
	PaginationQuery,
} from '../types';
import {
	ClinicalEntityData,
	ClinicalInfo,
	CompletionDisplayRecord,
	Donor,
} from '../clinical-entities';

type RecordsMap = {
	[key in ClinicalEntitySchemaNames]: ClinicalInfo[];
};

type EntityClinicalInfo = {
	entityName: ClinicalEntitySchemaNames;
	results: Array<ClinicalInfo>;
};

const DONOR_ID_FIELD = 'donor_id';

const isEntityInQuery = (entityName: ClinicalEntitySchemaNames, entityTypes: string[]) =>
	entityTypes.includes(aliasEntityNames[entityName]);

// Base Sort Function Wrapper
function sortDocs<SortArgs>(
	sortQuery: string,
	sortArgs: SortArgs,
	sortFunction: (currentRecord: ClinicalInfo, nextRecord: ClinicalInfo, args: SortArgs) => number,
) {
	return (currentRecord: ClinicalInfo, nextRecord: ClinicalInfo) => {
		// Sort Value: 0 order is Unchanged, -1 Current lower index than Next, +1 Current higher index than Next
		let order = 0;
		const isDescending = sortQuery.startsWith('-');

		order = sortFunction(currentRecord, nextRecord, sortArgs);

		order = isDescending ? -order : order;

		return order;
	};
}

// Sort Clinically Incomplete donors to top (sorted by donorId at DB level)
const sortDonorRecordsByCompletion = (
	currentRecord: ClinicalInfo,
	nextRecord: ClinicalInfo,
	completionStats: CompletionDisplayRecord[],
) => {
	const { donorId: currentDonorId } = currentRecord;
	const { donorId: nextDonorId } = nextRecord;

	const completionA =
		completionStats.find((record) => record.donorId && record.donorId === currentDonorId)
			?.coreCompletionPercentage || 0;

	const completionB =
		completionStats.find((record) => record.donorId && record.donorId === nextDonorId)
			?.coreCompletionPercentage || 0;

	const completionSort = completionA === completionB ? 0 : completionA > completionB ? -1 : 1;
	return completionSort;
};

// Sort by Selected Column
const sortRecordsByColumn = (
	currentRecord: ClinicalInfo,
	nextRecord: ClinicalInfo,
	key: string,
) => {
	const first = currentRecord[key] !== undefined && currentRecord[key];
	const next = nextRecord[key] !== undefined && nextRecord[key];
	const valueSort = first === next ? 0 : first && (!next || first > next) ? 1 : -1;

	return valueSort;
};

// Sort Invalid Records to Top
const sortInvalidRecords = (
	errors: ClinicalErrorsResponseRecord[],
	records: ClinicalInfo[],
	entityName: ClinicalEntitySchemaNames,
) => {
	const entityErrors = errors.filter((errorRecord) => errorRecord.entityName === entityName);
	const errorIds = new Set(entityErrors.map((error) => error.donorId));

	const validRecords: ClinicalInfo[] = [];
	const invalidRecords: ClinicalInfo[] = [];

	records.forEach((record) => {
		if (typeof record.donor_id === 'number') {
			if (!errorIds.has(record.donor_id)) {
				validRecords.push(record);
			} else {
				const currentRecordIsInvalid = entityErrors.find((errorRecord) => {
					const idValid = errorRecord.donorId === record.donor_id;
					const recordValid = errorRecord.errors.some((error) => {
						const recordValue = record[error.fieldName];
						const errorValue = Array.isArray(error.info.value)
							? error.info.value[0]
							: error.info.value;
						return recordValue === errorValue;
					});
					return idValid && recordValid;
				});
				if (currentRecordIsInvalid) {
					invalidRecords.push(record);
				} else {
					validRecords.push(record);
				}
			}
		}
	});

	return [...invalidRecords, ...validRecords];
};

// Formats + Organizes Clinical Data
const mapEntityDocuments = (
	entity: EntityClinicalInfo,
	donorCount: number,
	schemas: any,
	entityTypes: EntityAlias[],
	paginationQuery: PaginationQuery,
	completionStats: CompletionDisplayRecord[],
	sortType: ClinicalDataSortType,
	errors: ClinicalErrorsResponseRecord[],
): ClinicalEntityData | undefined => {
	const { entityName, results } = entity;

	// Filter, Paginate + Sort
	const { page, pageSize = results.length, sort } = paginationQuery;
	const relevantSchemaWithFields = schemas.find((s: any) => s.name === entityName);
	const entityInQuery = isEntityInQuery(entityName, entityTypes);

	if (!relevantSchemaWithFields || !entityInQuery || isEmpty(results)) {
		return undefined;
	}

	const totalDocs = entityName === ClinicalEntitySchemaNames.DONOR ? donorCount : results.length;

	let records = results;

	switch (sortType) {
		case ClinicalDataSortTypes.defaultDonor: {
			records = results.sort(sortDocs(sort, completionStats, sortDonorRecordsByCompletion));
			break;
		}
		case ClinicalDataSortTypes.invalidEntity: {
			records = sortInvalidRecords(errors, results, entityName);
			break;
		}
		// Column Sort is the default, fallback here is intentional
		case ClinicalDataSortTypes.columnSort:
		default: {
			const sortKey = sort[0] === '-' ? sort.split('-')[1] : sort;
			const key = sortKey === 'donorId' ? DONOR_ID_FIELD : sortKey;
			records = results.sort(sortDocs(sort, key, sortRecordsByColumn));
		}
	}

	if (records.length > pageSize) {
		// Manual Pagination
		const first = page * pageSize;
		const last = (page + 1) * pageSize;
		records = records.slice(first, last);
	}

	const completionDisplayRecords =
		entityName === ClinicalEntitySchemaNames.DONOR ? { completionStats: [...completionStats] } : {};

	return {
		entityName,
		totalDocs,
		records,
		...completionDisplayRecords,
		entityFields: [DONOR_ID_FIELD, ...relevantSchemaWithFields.fields],
	};
};

// Submitted Data Search Results
function FilterDonorIdDataFromSearch(donors: Donor[], query: ClinicalDonorEntityQuery) {
	const { donorIds, submitterDonorIds } = query;
	const useQueriedDonors = !isEmpty(donorIds) || !isEmpty(submitterDonorIds);
	const queriedEntities = Object.values(ClinicalEntitySchemaNames).filter((entity) =>
		isEntityInQuery(entity, query.entityTypes),
	);

	const filteredDonors = donors
		.filter((donor) => {
			if (useQueriedDonors) {
				// Enables Search by DonorId using partial terms, i.e. searching '262' returns all Donors where DonorId includes 262
				const { donorId, submitterId } = donor;
				const stringId = `${donorId}`;
				const donorMatch = donorIds?.some((id) => stringId.includes(`${id}`));
				const submitterMatch = submitterDonorIds?.some((id) => submitterId.includes(id));
				return donorMatch || submitterMatch;
			}
			return donor;
		})
		.filter((donor) => {
			//  This filters out false positive search results ( i.e. where Donor.treatments = [] )
			if (!queriedEntities.includes(ClinicalEntitySchemaNames.DONOR)) {
				const clinicalInfoRecords = queriedEntities.map((entity) =>
					getClinicalEntitySubmittedData(donor, entity),
				);

				// Only include Donor if it has related records
				const hasRecords = !(
					clinicalInfoRecords.length === 1 && clinicalInfoRecords[0].length === 0
				);

				return hasRecords;
			}
			return donor;
		});

	const totalResults = filteredDonors.length;
	const searchResults = filteredDonors.map(({ donorId, submitterId }: Donor) => ({
		donorId,
		submitterDonorId: submitterId,
	}));

	return { searchResults, totalResults };
}

// Main TSV Clinical Data Function
function extractDataFromDonors(donors: DeepReadonly<Donor>[], schemasWithFields: any) {
	const recordsMap = <RecordsMap>{};

	donors.forEach((d) => {
		Object.values(ClinicalEntitySchemaNames).forEach((entity) => {
			const clinicalInfoRecords =
				entity === ClinicalEntitySchemaNames.REGISTRATION
					? getSampleRegistrationDataFromDonor(d)
					: getClinicalEntitiesFromDonorBySchemaName(d, entity);

			recordsMap[entity] = _.concat(recordsMap[entity] || [], clinicalInfoRecords);
		});
	});

	const data = Object.entries(recordsMap)
		.map(([entityName, records]) => {
			if (isEmpty(records)) return undefined;

			const relevantSchemaWithFields = schemasWithFields.find((s: any) => s.name === entityName);
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

	return data;
}

/**
 * Main Clinical Entity Submitted Data Function
 * @param donors
 * @param totalDonors
 * @param schemasWithFields
 * @param entityTypes
 * @param paginationQuery
 * @returns
 */
function extractEntityDataFromDonors(
	donors: Donor[],
	totalDonors: number,
	schemasWithFields: any,
	entityTypes: EntityAlias[],
	paginationQuery: PaginationQuery,
	sortType: ClinicalDataSortType,
	errors: ClinicalErrorsResponseRecord[],
	singleSpecimenExceptions: string[],
) {
	let clinicalEntityData: EntityClinicalInfo[] = [];

	donors.forEach((d) => {
		Object.values(ClinicalEntitySchemaNames).forEach((entityName) => {
			const isQueriedEntity = isEntityInQuery(entityName, entityTypes);
			const isRelatedEntity = getRequiredDonorFieldsForEntityTypes(entityTypes).includes(
				entityName,
			);
			const requiresSampleRegistration =
				entityName === ClinicalEntitySchemaNames.REGISTRATION &&
				(entityTypes.includes('donor') || entityTypes.includes('sampleRegistration'));
			const requiresSpecimens =
				entityName === ClinicalEntitySchemaNames.SPECIMEN && entityTypes.includes('donor');

			const isRequiredEntity =
				isQueriedEntity || isRelatedEntity || requiresSampleRegistration || requiresSpecimens;

			const clinicalInfoRecords = isRequiredEntity
				? getClinicalEntitySubmittedData(d, entityName)
				: [];

			const relatedEntity = clinicalEntityData.find(
				(entityData) => entityData.entityName === entityName,
			);
			if (relatedEntity) {
				relatedEntity.results = _.concat(relatedEntity.results, clinicalInfoRecords);
			} else {
				const clinicalEntity: EntityClinicalInfo = { entityName, results: clinicalInfoRecords };
				clinicalEntityData = _.concat(clinicalEntityData, clinicalEntity);
			}
		});
	});

	const completionStats: CompletionDisplayRecord[] = donors
		.map(({ completionStats, donorId, specimens: donorSpecimenRecords, programId }) => {
			// Add display data for Specimen Normal/Tumour completion stats
			const filteredSpecimenData = donorSpecimenRecords?.filter(filterHasDnaSample) || [];

			const hasSingleSpecimenException = singleSpecimenExceptions.includes(programId);
			const specimens = {
				specimens: calculateSpecimenCompletionStats(
					filteredSpecimenData,
					hasSingleSpecimenException,
				),
			};

			const completionRecord: CompletionDisplayRecord | undefined =
				completionStats && donorId
					? { ...completionStats, donorId, entityData: specimens }
					: undefined;

			return completionRecord;
		})
		.filter(notEmpty);

	const clinicalEntities: ClinicalEntityData[] = clinicalEntityData
		.map((entity: EntityClinicalInfo) =>
			mapEntityDocuments(
				entity,
				totalDonors,
				schemasWithFields,
				entityTypes,
				paginationQuery,
				completionStats,
				sortType,
				errors,
			),
		)
		.filter(notEmpty);

	const data = {
		clinicalEntities,
	};

	return data;
}

export enum WorkerTasks {
	ExtractDataFromDonors,
	ExtractEntityDataFromDonors,
	FilterDonorIdDataFromSearch,
}

export const WorkerTasksMap: Record<WorkerTasks, Function> = {
	[WorkerTasks.ExtractDataFromDonors]: extractDataFromDonors,
	[WorkerTasks.ExtractEntityDataFromDonors]: extractEntityDataFromDonors,
	[WorkerTasks.FilterDonorIdDataFromSearch]: FilterDonorIdDataFromSearch,
};
