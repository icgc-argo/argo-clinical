/*
 * Copyright (c) 2022 The Ontario Institute for Cancer Research. All rights reserved
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

export type ObjectValues<T> = T[keyof T];

export type ExceptionRecord = {
  program_name: string;
  schema: string;
  requested_core_field: string;
  requested_exception_value: string;
};

export type ProgramExceptionRecord = ExceptionRecord;

// type after validation
export type ProgramException = {
  programId: string;
  exceptions: ReadonlyArray<ProgramExceptionRecord>;
};

// Entity
export type SpecimenExceptionRecord = ExceptionRecord & {
  submitter_donor_id: string;
  submitter_specimen_id: string;
};

export type FollowUpExceptionRecord = ExceptionRecord & {
  submitter_followup_id: string;
};

export type EntityExceptionRecord = SpecimenExceptionRecord | FollowUpExceptionRecord;

export type EntityException = {
  programId: string;
  specimen: SpecimenExceptionRecord[];
  followup: FollowUpExceptionRecord[];
};

export const EntityValues = {
  specimen: 'specimen',
  followup: 'followup',
} as const;

export type Entity = ObjectValues<typeof EntityValues>;

// Exception Values

export const ExceptionValue = {
  Unknown: 'Unknown',
  NotApplicable: 'Not applicable',
} as const;

export type ExceptionValueType = ObjectValues<typeof ExceptionValue>;

// predicate helpers
const isExceptionRecordCheck = (input: any) => {
  return (
    // input must not be null and be an object (typeof null = 'object', amusingly)
    typeof input === 'object' &&
    input !== null &&
    // program_name must exist and be string
    'program_name' in input &&
    typeof input.program_name === 'string' &&
    // schema must exist and be string
    'schema' in input &&
    typeof input.schema === 'string' &&
    // requested_core_field must exist and be string
    'requested_core_field' in input &&
    typeof input.requested_core_field === 'string' &&
    // requested_exception_value must exist and be string and be in enum list
    'requested_exception_value' in input &&
    typeof input.requested_exception_value === 'string'
  );
};

const isSpecimenExceptionRecord = (input: any): boolean => {
  return (
    // submitter_specimen_id must exist and be a string
    'submitter_specimen_id' in input && typeof input.submitter_specimen_id === 'string'
  );
};

// predicate

const isEntityExceptionRecord = (input: any): input is EntityException => {
  return isExceptionRecordCheck(input) && isSpecimenExceptionRecord(input);
};

const isExceptionRecord = (input: any): input is ExceptionRecord => isExceptionRecordCheck(input);

export const isProgramExceptionRecord = isExceptionRecord;

export type EntityExceptionRecords = (SpecimenExceptionRecord | FollowUpExceptionRecord)[];
export const isArrayOfEntityExceptionRecord = (input: any): input is EntityExceptionRecords =>
  input.every((i: any) => isEntityExceptionRecord(i));

// array helpers
export const isArrayOf = <T>(input: any[], validator: (_: any) => _ is T): input is T[] => {
  return input.every(validator);
};

export const isReadonlyArrayOf = <T>(
  input: ReadonlyArray<any>,
  validator: (_: any) => _ is T,
): input is ReadonlyArray<T> => {
  return input.every(validator);
};
