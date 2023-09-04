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

import get from 'lodash/get';
import {
  SubmissionValidationError,
  SubmissionValidationUpdate,
} from '../submission/submission-entities';
import { DeepReadonly } from 'deep-freeze';

const ARRAY_DELIMITER_CHAR = '|';

// Generic Record
type EntityDataRecord = { [k: string]: any; donor_id?: number };

const convertClinicalRecordToGql = (index: number | string, record: EntityDataRecord) => {
  const fields = [];
  for (const field in record) {
    const value = normalizeValue(record[field]);
    fields.push({ name: field, value: value });
  }
  return {
    row: index,
    fields: fields,
  };
};

const convertRegistrationErrorToGql = (errorData: RegistrationErrorData) => ({
  type: errorData.type,
  message: errorData.message,
  row: errorData.index,
  field: errorData.fieldName,
  value: normalizeValue(errorData.info.value),
  sampleId: errorData.info.sampleSubmitterId,
  donorId: errorData.info.donorSubmitterId,
  specimenId: errorData.info.specimenSubmitterId,
});

function normalizeValue(val: unknown) {
  if (Array.isArray(val)) {
    return val.map(convertToString).join(ARRAY_DELIMITER_CHAR);
  }
  return convertToString(val);
}

function convertToString(val: unknown) {
  return val === undefined || val === null ? '' : `${val}`;
}

const convertClinicalFileErrorToGql = (fileError: {
  message: string;
  batchNames: string[];
  code: string;
}) => {
  return {
    message: fileError.message,
    fileNames: fileError.batchNames,
    code: fileError.code,
  };
};

const convertRegistrationStatsToGql = (
  statsEntry: {
    submitterId: string;
    rowNumbers: (string | number)[];
  }[],
) => {
  const output = {
    count: 0,
    rows: [] as (string | number)[],
    names: [] as string[],
    values: [] as { name: string; rows: (string | number)[] }[],
  };
  const names = statsEntry.map(se => se.submitterId) || ([] as string[]);
  output.count = names.length;
  names.forEach(name => {
    output.names.push(name);
    const rows = statsEntry.find(se => se.submitterId == name)?.rowNumbers || [];
    rows.forEach(row => !output.rows.includes(row) && output.rows.push(row));
    output.values.push({ name, rows });
  });

  return output;
};

type RegistrationErrorData = ErrorData & {
  info: {
    value: string;
    sampleSubmitterId: string;
    donorSubmitterId: string;
    specimenSubmitterId: string;
  };
};

type ErrorData = {
  type: string;
  message: string;
  index: number | string;
  fieldName: string;
};

// Clinical Submission

export interface SubmissionEntity {
  batchName?: string | undefined;
  creator?: string | undefined;
  records?: ReadonlyArray<Readonly<{ [key: string]: string }>> | undefined;
  createdAt?: DeepReadonly<Date> | undefined;
  schemaErrors?: DeepReadonly<SubmissionValidationError[]> | undefined;
  dataErrors?: DeepReadonly<SubmissionValidationError[]> | undefined;
  dataWarnings?: DeepReadonly<SubmissionValidationError[]> | undefined;
  dataUpdates?: DeepReadonly<SubmissionValidationUpdate[]> | undefined;
  stats?:
    | DeepReadonly<{
        new: number[];
        noUpdate: number[];
        updated: number[];
        errorsFound: number[];
      }>
    | undefined;
}

const convertClinicalSubmissionEntityToGql = (clinicalType: string, entity: SubmissionEntity) => {
  return {
    clinicalType,
    batchName: entity.batchName || undefined,
    creator: entity.creator || undefined,
    records: () =>
      get(entity, 'records', [] as typeof entity.records)?.map((record, index) =>
        convertClinicalRecordToGql(index, record),
      ),
    stats: entity.stats || undefined,
    schemaErrors: () => {
      const entityErrors = entity.schemaErrors || [];
      return entityErrors.map(error =>
        convertClinicalSubmissionSchemaErrorToGql(clinicalType, error),
      );
    },
    dataErrors: () =>
      get(entity, 'dataErrors', [] as typeof entity.dataErrors)?.map((error: ErrorData) =>
        convertClinicalSubmissionDataErrorToGql(error),
      ),
    dataWarnings: () =>
      get(entity, 'dataWarnings', [] as typeof entity.dataWarnings)?.map((warning: ErrorData) =>
        convertClinicalSubmissionDataErrorToGql(warning),
      ),
    dataUpdates: () =>
      get(entity, 'dataUpdates', [] as typeof entity.dataUpdates)?.map(update =>
        convertClinicalSubmissionUpdateToGql(update),
      ),
    createdAt: entity.createdAt ? entity.createdAt : undefined,
  };
};

const convertClinicalSubmissionSchemaErrorToGql = (
  clinicalType: unknown,
  errorData: ErrorData,
) => ({
  ...convertClinicalSubmissionDataErrorToGql(errorData),
  clinicalType,
});

const convertClinicalSubmissionDataErrorToGql = (errorData: ErrorData) => {
  // errorData.info.value may come back as null if not provided in uploaded file
  const errorValue = get(errorData, 'info.value', '') || '';
  return {
    type: errorData.type,
    message: errorData.message,
    row: errorData.index,
    field: errorData.fieldName,
    donorId: get(errorData, 'info.donorSubmitterId', '') || '',
    value: normalizeValue(errorValue),
  };
};

type UpdateData = {
  index: string | number;
  fieldName: string;
  info: {
    newValue: unknown;
    oldValue: unknown;
    donorSubmitterId: string;
  };
};

const convertClinicalSubmissionUpdateToGql = (updateData: UpdateData) => {
  return {
    row: updateData.index,
    field: updateData.fieldName,
    newValue: normalizeValue(updateData.info.newValue),
    oldValue: normalizeValue(updateData.info.oldValue),
    donorId: updateData.info.donorSubmitterId,
  };
};

export {
  convertClinicalRecordToGql,
  convertRegistrationErrorToGql,
  convertClinicalFileErrorToGql,
  convertRegistrationStatsToGql,
  RegistrationErrorData,
  convertClinicalSubmissionEntityToGql,
};
