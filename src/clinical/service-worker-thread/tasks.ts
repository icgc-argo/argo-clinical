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
import { ClinicalDonorEntityQuery, getClinicalErrors, PaginationQuery } from '../clinical-service';
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

enum sortTypes {
	'defaultDonor' = 'defaultDonor',
	'invalidEntity' = 'invalidEntity',
	'columnSort' = 'columnSort',
}

const isEntityInQuery = (entityName: ClinicalEntitySchemaNames, entityTypes: string[]) =>
	entityTypes.includes(aliasEntityNames[entityName]);

// Main Sort Function
const sortDocs = (
	sortQuery: string,
	sortType: sortTypes,
	completionStats: CompletionDisplayRecord[],
	errors: ClinicalErrorsResponseRecord[],
) => (currentRecord: ClinicalInfo, nextRecord: ClinicalInfo) => {
	// Sort Value: 0 order is Unchanged, -1 Current lower index than Next, +1 Current higher index than Next
	let order = 0;

	const isDescending = sortQuery.startsWith('-');
	const queryKey = isDescending ? sortQuery.split('-')[1] : sortQuery;
	const key = queryKey === 'donorId' ? DONOR_ID_FIELD : queryKey;
	console.log('\nsortType', sortType);
	if (sortType === sortTypes['defaultDonor']) {
		order = sortDonorRecordsByCompletion(currentRecord, nextRecord, completionStats);
	} else if (sortType === sortTypes['invalidEntity']) {
		order = sortInvalidRecords(currentRecord, nextRecord, errors);
	} else {
		order = sortRecordsByColumn(currentRecord, nextRecord, key);
	}

	order = isDescending ? -order : order;

	return order;
};

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

// Sort Invalid Records to Top
const sortInvalidRecords = (
	currentRecord: ClinicalInfo,
	nextRecord: ClinicalInfo,
	errors: ClinicalErrorsResponseRecord[],
) => {
	const currentRecordIsInvalid = errors.some((record) => record.donorId === currentRecord.donor_id);
	const nextRecordIsInvalid = errors.some((record) => record.donorId === nextRecord.donor_id);

	const invalidSort =
		currentRecordIsInvalid === nextRecordIsInvalid ? 0 : currentRecordIsInvalid ? -1 : 1;

	return invalidSort;
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

// Formats + Organizes Clinical Data
const mapEntityDocuments = (
	entity: EntityClinicalInfo,
	donorCount: number,
	schemas: any,
	entityTypes: EntityAlias[],
	paginationQuery: PaginationQuery,
	completionStats: CompletionDisplayRecord[],
	errors: ClinicalErrorsResponseRecord[],
	sortType: sortTypes,
): ClinicalEntityData | undefined => {
	const { entityName, results } = entity;
	console.log('\n entityTypes', entityTypes);
	console.log('\n paginationQuery', paginationQuery);
	// Filter, Paginate + Sort
	const { page, pageSize = results.length, sort } = paginationQuery;
	const relevantSchemaWithFields = schemas.find((s: any) => s.name === entityName);
	const entityInQuery = isEntityInQuery(entityName, entityTypes);
	const entityErrors = errors.filter((errorRecord) => errorRecord.entityName === entityName);

	if (!relevantSchemaWithFields || !entityInQuery || isEmpty(results)) {
		return undefined;
	}

	const totalDocs = entityName === ClinicalEntitySchemaNames.DONOR ? donorCount : results.length;
	console.log('\n entityErrors', entityErrors);

	let records = results.sort(sortDocs(sort, sortType, completionStats, entityErrors));

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
 * @param programId
 * @param donors
 * @param totalDonors
 * @param schemasWithFields
 * @param entityTypes
 * @param paginationQuery
 * @returns
 */
async function extractEntityDataFromDonors(
	programId: string,
	donors: Donor[],
	totalDonors: number,
	schemasWithFields: any,
	entityTypes: EntityAlias[],
	paginationQuery: PaginationQuery,
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
		.map(({ completionStats, donorId, specimens: donorSpecimenRecords }) => {
			// Add display data for Specimen Normal/Tumour completion stats
			const filteredSpecimenData = donorSpecimenRecords?.filter(filterHasDnaSample) || [];
			const specimens = { specimens: calculateSpecimenCompletionStats(filteredSpecimenData) };

			const completionRecord: CompletionDisplayRecord | undefined =
				completionStats && donorId
					? { ...completionStats, donorId, entityData: specimens }
					: undefined;

			return completionRecord;
		})
		.filter(notEmpty);

	const isDefaultDonorSort =
		// entityName === ClinicalEntitySchemaNames.DONOR &&
		paginationQuery.sort.includes('completionStats.coreCompletionPercentage');

	const isInvalidSort =
		// !(entityName === ClinicalEntitySchemaNames.DONOR) &&
		paginationQuery.sort.includes('schemaMetadata.isValid');

	const sortType = isDefaultDonorSort
		? sortTypes['defaultDonor']
		: isInvalidSort
		? sortTypes['invalidEntity']
		: sortTypes['columnSort'];

	const getErrorsForSorting = async () => {
		const donorIds = donors.map((donor) => donor.donorId);
		return (await getClinicalErrors(programId, donorIds)).clinicalErrors;
	};

	const errors: ClinicalErrorsResponseRecord[] = [];
	// sortType === sortTypes['invalidEntity'] ?
	// await getErrorsForSorting() : [];

	const clinicalEntities: ClinicalEntityData[] = clinicalEntityData
		.map((entity: EntityClinicalInfo) =>
			mapEntityDocuments(
				entity,
				totalDonors,
				schemasWithFields,
				entityTypes,
				paginationQuery,
				completionStats,
				errors,
				sortType,
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
