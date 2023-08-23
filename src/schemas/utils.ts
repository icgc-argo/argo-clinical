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
import { ActiveRegistration } from '../submission/submission-entities';
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

export {
  convertClinicalRecordToGql,
  convertRegistrationErrorToGql,
  convertClinicalFileErrorToGql,
  convertRegistrationStatsToGql,
  RegistrationErrorData,
};
