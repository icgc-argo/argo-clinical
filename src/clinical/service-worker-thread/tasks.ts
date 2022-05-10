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
import { ClinicalEntitySchemaNames } from '../../common-model/entities';
import { getClinicalEntitiesFromDonorBySchemaName } from '../../common-model/functions';
import { notEmpty } from '../../utils';
import { Donor, CompletionStats } from '../clinical-entities';

interface CompletionRecord extends CompletionStats {
  donorId?: number;
}

const donorIdField = 'donor_id';

function extractDataFromDonors(donors: Donor[], schemasWithFields: any) {
  const recordsMap: any = {};

  donors.forEach(d => {
    Object.values(ClinicalEntitySchemaNames).forEach(entity => {
      const clinicalInfoRecords = getClinicalEntitiesFromDonorBySchemaName(d, entity);

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

function extractEntityDataFromDonors(donors: Donor[], schemasWithFields: any) {
  const recordsMap: any = {};

  const completionStats: CompletionRecord[] = donors
    .map(({ completionStats, donorId }): CompletionRecord | undefined =>
      completionStats && donorId ? { ...completionStats, donorId } : undefined,
    )
    .filter(notEmpty);

  donors.forEach(d => {
    Object.values(ClinicalEntitySchemaNames).forEach(entity => {
      const clinicalInfoRecords = getClinicalEntitiesFromDonorBySchemaName(d, entity).map(
        clinicalInfo => ({
          donorId: d.donorId,
          ...clinicalInfo,
        }),
      );
      recordsMap[entity] = _.concat(recordsMap[entity] || [], clinicalInfoRecords);
    });
  });

  const clinicalEntities = Object.entries(recordsMap)
    .map(([entityName, records]) => {
      if (isEmpty(records)) return undefined;

      const relevantSchemaWithFields = schemasWithFields.find((s: any) => s.name === entityName);
      if (!relevantSchemaWithFields) {
        throw new Error(`Can't find schema ${entityName}, something is wrong here!`);
      }

      return {
        entityName,
        records,
        entityFields: [donorIdField, ...relevantSchemaWithFields.fields],
      };
    })
    .filter(notEmpty);

  const data = {
    clinicalEntities,
    completionStats,
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
