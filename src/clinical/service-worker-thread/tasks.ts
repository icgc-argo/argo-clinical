/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
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

import _, { isEmpty } from 'lodash';
import {
  ClinicalEntitySchemaNames,
  aliasEntityNames,
  queryEntityNames,
} from '../../common-model/entities';
import {
  getRequiredDonorFieldsForEntityTypes,
  getClinicalEntitiesFromDonorBySchemaName,
  getClinicalEntitySubmittedData,
} from '../../common-model/functions';
import { notEmpty } from '../../utils';
import { ClinicalQuery, ClinicalSearchQuery } from '../clinical-api';
import {
  Donor,
  CompletionRecord,
  ClinicalEntityData,
  ClinicalInfo,
  CoreClinicalEntities,
} from '../clinical-entities';

type RecordsMap = {
  [key in ClinicalEntitySchemaNames]: ClinicalInfo[];
};

type EntityClinicalInfo = {
  entityName: ClinicalEntitySchemaNames;
  results: Array<ClinicalInfo>;
};

const DONOR_ID_FIELD = 'donor_id';

const updateCompletionTumourStats = (
  specimen: ClinicalInfo,
  type: string,
  completionRecords: { completionStats: CompletionRecord[] },
) => {
  const specimenType: CoreClinicalEntities =
    type === 'normal' ? 'normalSpecimens' : 'tumourSpecimens';
  const index = completionRecords.completionStats.findIndex(
    donor => donor.donorId === specimen.donor_id,
  );
  if (index !== -1) {
    const original = completionRecords.completionStats[index];
    completionRecords.completionStats[index] = {
      ...original,
      coreCompletion: {
        ...original.coreCompletion,
        [specimenType]: 1,
      },
    };
  }
};

function getSampleRegistrationDataFromDonor(donor: Donor) {
  const baseRegistrationRecord = {
    program_id: donor.programId,
    submitter_donor_id: donor.submitterId,
    gender: donor.gender,
  };

  const sample_registration = donor.specimens
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

  return sample_registration;
}

const isEntityInQuery = (entityName: ClinicalEntitySchemaNames, entityTypes: string[]) =>
  queryEntityNames.includes(aliasEntityNames[entityName]) &&
  entityTypes.includes(aliasEntityNames[entityName]);

// Main Sort Function
const sortDocs = (sortQuery: string, entityName: string, completionStats: CompletionRecord[]) => (
  currentRecord: ClinicalInfo,
  nextRecord: ClinicalInfo,
) => {
  // Sort Value: 0 order is Unchanged, -1 Current lower index than Next, +1 Current higher index than Next
  let order = 0;
  const isDefaultSort =
    entityName === ClinicalEntitySchemaNames.DONOR && sortQuery.includes('donorId');
  const isDescending = sortQuery.startsWith('-') ? -1 : 1;
  const key = isDescending === -1 ? sortQuery.split('-')[1] : sortQuery;

  if (isDefaultSort) {
    order = sortDonorRecordsByCompletion(currentRecord, nextRecord, completionStats);
  } else {
    order = sortRecordsByColumn(currentRecord, nextRecord, key);
  }

  order = order * isDescending;

  return order;
};

// Sort Clinically Incomplete donors to top (sorted by donorId at DB level)
const sortDonorRecordsByCompletion = (
  currentRecord: ClinicalInfo,
  nextRecord: ClinicalInfo,
  completionStats: CompletionRecord[],
) => {
  const { donorId: currentDonorId } = currentRecord;
  const { donorId: nextDonorId } = nextRecord;

  const completionA =
    completionStats.find(record => record.donorId && record.donorId === currentDonorId)
      ?.coreCompletionPercentage || 0;

  const completionB =
    completionStats.find(record => record.donorId && record.donorId === nextDonorId)
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

const mapEntityDocuments = (
  entity: EntityClinicalInfo,
  originalResultsArray: EntityClinicalInfo[],
  donorCount: number,
  schemas: any,
  query: ClinicalQuery,
  completionStats: CompletionRecord[],
) => {
  const { entityName, results } = entity;

  // Filter, Paginate + Sort
  const { page, pageSize = results.length, sort, entityTypes } = query;
  const relevantSchemaWithFields = schemas.find((s: any) => s.name === entityName);
  const entityInQuery = isEntityInQuery(entityName, entityTypes);

  if (!relevantSchemaWithFields || !entityInQuery || isEmpty(results)) {
    return undefined;
  }

  const totalDocs = entityName === ClinicalEntitySchemaNames.DONOR ? donorCount : results.length;
  let records = results.sort(sortDocs(sort, entityName, completionStats));

  if (records.length > pageSize) {
    // Manual Pagination
    const first = page * pageSize;
    const last = (page + 1) * pageSize;
    records = records.slice(first, last);
  }

  // Update Completion Stats to display Normal/Tumour stats
  const completionRecords =
    entityName === ClinicalEntitySchemaNames.DONOR ? { completionStats: [...completionStats] } : {};
  const samples = originalResultsArray.find(result => result.entityName === 'sample_registration');

  if (completionRecords.completionStats && samples !== undefined) {
    const sampleResults = samples.results as ClinicalInfo[];
    const sampleData = sampleResults.filter(
      sample => typeof sample.sample_type === 'string' && !sample.sample_type?.includes('RNA'),
    );

    sampleData.forEach(sample => {
      if (typeof sample.tumour_normal_designation === 'string') {
        const designation = sample.tumour_normal_designation.toLowerCase();
        updateCompletionTumourStats(sample, designation, completionRecords);
      }
    });
  }

  return <ClinicalEntityData>{
    entityName,
    totalDocs,
    records,
    ...completionRecords,
    entityFields: [DONOR_ID_FIELD, ...relevantSchemaWithFields.fields],
  };
};

function extractDataFromDonors(donors: Donor[], schemasWithFields: any) {
  const recordsMap = <RecordsMap>{};

  donors.forEach(d => {
    Object.values(ClinicalEntitySchemaNames).forEach(entity => {
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

export function filterDonorIdDataFromSearch(donors: Donor[], query: ClinicalSearchQuery) {
  const { donorIds, submitterDonorIds } = query;

  const useFilteredDonors =
    (donorIds && donorIds.length) || (submitterDonorIds && submitterDonorIds.length);

  const filteredDonors = useFilteredDonors
    ? donors.filter(donor => {
        const { donorId, submitterId } = donor;
        const stringId = `${donorId}`;
        const donorMatch = donorIds?.filter(id => stringId.includes(id));
        const submitterMatch = submitterId
          ? submitterDonorIds?.filter(id => submitterId.includes(id))
          : [];
        return donorMatch.length > 0 || submitterMatch.length > 0;
      })
    : donors;

  const totalResults = filteredDonors.length;
  const searchResults = filteredDonors.map((donor: Donor) => {
    const { donorId, submitterId } = donor;
    const submitterDonorId = submitterId;
    return { donorId, submitterDonorId };
  });

  return { searchResults, totalResults };
}

export function extractEntityDataFromDonors(
  donors: Donor[],
  totalDonors: number,
  schemasWithFields: any,
  query: ClinicalQuery,
) {
  let clinicalEntityData: EntityClinicalInfo[] = [];

  const completionStats: CompletionRecord[] = donors
    .map(({ completionStats, donorId }): CompletionRecord | undefined =>
      completionStats && donorId ? { ...completionStats, donorId } : undefined,
    )
    .filter(notEmpty);

  donors.forEach(d => {
    Object.values(ClinicalEntitySchemaNames).forEach(entity => {
      const isQueriedType = isEntityInQuery(entity, query.entityTypes);
      const isRequiredType = getRequiredDonorFieldsForEntityTypes(query.entityTypes).includes(
        entity,
      );
      const clinicalInfoRecords =
        isQueriedType || isRequiredType
          ? entity === ClinicalEntitySchemaNames.REGISTRATION
            ? getSampleRegistrationDataFromDonor(d)
                .filter(notEmpty)
                .map(sample => ({ donor_id: d.donorId, ...sample }))
            : getClinicalEntitySubmittedData(d, entity)
          : [];

      const relatedEntity = clinicalEntityData.find(entityData => entityData.entityName === entity);
      if (relatedEntity) {
        relatedEntity.results = _.concat(relatedEntity.results, clinicalInfoRecords);
      } else {
        const clinicalEntity = { entityName: entity, results: clinicalInfoRecords };
        clinicalEntityData = _.concat(clinicalEntityData, clinicalEntity);
      }
    });
  });

  const donorCount = totalDonors;
  const clinicalEntities: ClinicalEntityData[] = clinicalEntityData
    .map((entity: EntityClinicalInfo, index: number, originalResultsArray: EntityClinicalInfo[]) =>
      mapEntityDocuments(
        entity,
        originalResultsArray,
        donorCount,
        schemasWithFields,
        query,
        completionStats,
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
}

export const WorkerTasksMap: Record<WorkerTasks, Function> = {
  [WorkerTasks.ExtractDataFromDonors]: extractDataFromDonors,
  [WorkerTasks.ExtractEntityDataFromDonors]: extractEntityDataFromDonors,
};
