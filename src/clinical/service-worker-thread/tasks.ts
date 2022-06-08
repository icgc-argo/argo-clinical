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
import { ClinicalEntitySchemaNames, aliasEntityNames } from '../../common-model/entities';
import { requiredEntities } from '../../common-model/functions';
import {
  getClinicalEntitiesFromDonorBySchemaName,
  getClinicalEntitySubmittedData,
} from '../../common-model/functions';
import { notEmpty } from '../../utils';
import { ClinicalQuery } from '../clinical-api';
import { Donor, CompletionStats, ClinicalInfo } from '../clinical-entities';

interface CompletionRecord extends CompletionStats {
  donorId?: number;
}

type RecordsMap = {
  [key in ClinicalEntitySchemaNames]: ClinicalInfo[];
};

const queryEntityNames = <string[]>Object.values(aliasEntityNames);

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

const DONOR_ID_FIELD = 'donor_id';

const isEntityInQuery = (entityName: string, entityTypes: string[]) =>
  queryEntityNames.includes(aliasEntityNames[entityName]) &&
  entityTypes.includes(aliasEntityNames[entityName]);

const sortDocs = (sort: string) => (currentRecord: ClinicalInfo, nextRecord: ClinicalInfo) => {
  const isDescending = sort.split('-')[1] !== undefined;
  const key = !isDescending ? sort.split('-')[0] : sort.split('-')[1];
  const first = currentRecord[key] !== undefined ? (currentRecord[key] as number) : -1;
  const next = nextRecord[key] !== undefined ? (nextRecord[key] as number) : -1;
  const order = first === next ? 0 : first > next && isDescending ? -1 : 1;

  return order;
};

const mapEntityDocuments = (
  totalDonors: number,
  schemas: any,
  query: ClinicalQuery,
  completionStats: CompletionRecord[],
) => (
  entity: [string, ClinicalInfo[]],
  index: number,
  originalResultsArray: [string, ClinicalInfo[]][],
) => {
  const [entityName, results] = entity;
  const { page, pageSize, sort, entityTypes } = query;

  const relevantSchemaWithFields = schemas.find((s: any) => s.name === entityName);
  const entityInQuery = isEntityInQuery(entityName, entityTypes);

  if (!relevantSchemaWithFields || !entityInQuery || isEmpty(results)) {
    return undefined;
  }

  const totalDocs = entityName === ClinicalEntitySchemaNames.DONOR ? totalDonors : results.length;
  const first = page * pageSize;
  const last = (page + 1) * pageSize;
  const records = results.sort(sortDocs(sort)).slice(first, last);
  const completionRecords =
    entityName === ClinicalEntitySchemaNames.DONOR ? { completionStats: [...completionStats] } : {};
  const samples = originalResultsArray.find(result => result[0] === 'sample_registration');

  if (completionRecords.completionStats && samples !== undefined) {
    const updateCompletionTumourStats = (specimen: ClinicalInfo, type: string) => {
      const specimenType = `${type}Specimens`;
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

    const normalSpecimens = samples[1].filter(
      sample => sample.tumour_normal_designation === 'Normal',
    );
    const tumourSpecimens = samples[1].filter(
      sample => sample.tumour_normal_designation === 'Tumour',
    );
    normalSpecimens.forEach(specimen => updateCompletionTumourStats(specimen, 'normal'));
    tumourSpecimens.forEach(specimen => updateCompletionTumourStats(specimen, 'tumour'));
  }

  return {
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

export function extractEntityDataFromDonors(
  donors: Donor[],
  totalDonors: number,
  schemasWithFields: any,
  query: ClinicalQuery,
) {
  const recordsMap = <RecordsMap>{};

  const completionStats: CompletionRecord[] = donors
    .map(({ completionStats, donorId }): CompletionRecord | undefined =>
      completionStats && donorId ? { ...completionStats, donorId } : undefined,
    )
    .filter(notEmpty);

  donors.forEach(d => {
    Object.values(ClinicalEntitySchemaNames).forEach(entity => {
      const isQueriedType = isEntityInQuery(entity, query.entityTypes);
      const isRequiredType = requiredEntities(query.entityTypes).includes(entity);
      const clinicalInfoRecords =
        isQueriedType || isRequiredType
          ? entity === ClinicalEntitySchemaNames.REGISTRATION
            ? getSampleRegistrationDataFromDonor(d)
                .filter(notEmpty)
                .map(sample => ({ donor_id: d.donorId, ...sample }))
            : getClinicalEntitySubmittedData(d, entity)
          : [];
      recordsMap[entity] = _.concat(recordsMap[entity] || [], clinicalInfoRecords);
    });
  });

  const clinicalEntities = Object.entries(recordsMap)
    .map(mapEntityDocuments(totalDonors, schemasWithFields, query, completionStats))
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
