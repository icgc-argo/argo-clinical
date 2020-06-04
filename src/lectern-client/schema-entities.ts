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

import { loggerFor } from '../logger';
import { DeepReadonly } from 'deep-freeze';
const L = loggerFor(__filename);

export class DataRecord {
  readonly [k: string]: string | string[];
}

export class TypedDataRecord {
  readonly [k: string]: SchemaTypes;
}

export type SchemaTypes = string | string[] | boolean | boolean[] | number | number[] | undefined;

export interface SchemasDictionary {
  version: string;
  name: string;
  schemas: Array<SchemaDefinition>;
}

export interface SchemaDefinition {
  readonly name: string;
  readonly description: string;
  readonly fields: ReadonlyArray<FieldDefinition>;
}

export interface SchemasDictionaryDiffs {
  [fieldName: string]: FieldDiff;
}

export interface FieldDiff {
  before?: FieldDefinition;
  after?: FieldDefinition;
  diff: FieldChanges;
}

// changes can be nested
// in case of created/delete field we get Change
// in case of simple field change we get {"fieldName": {"data":.., "type": ..}}
// in case of nested fields: {"fieldName1": {"fieldName2": {"data":.., "type": ..}}}
export type FieldChanges = { [field: string]: FieldChanges } | Change;

export enum ChangeTypeName {
  CREATED = 'created',
  DELETED = 'deleted',
  UPDATED = 'updated',
}

export interface Change {
  type: ChangeTypeName;
  data: any;
}

export interface FieldDefinition {
  name: string;
  valueType: ValueType;
  description: string;
  meta?: { key?: boolean; default?: SchemaTypes; core?: boolean; examples?: string };
  restrictions?: {
    codeList?: CodeListRestriction;
    regex?: string;
    script?: Array<string> | string;
    required?: boolean;
    range?: RangeRestriction;
  };
  isArray?: boolean;
}

export type CodeListRestriction = Array<string | number>;

export type RangeRestriction = {
  min?: number;
  max?: number;
  exclusiveMin?: number;
  exclusiveMax?: number;
};

export enum ValueType {
  STRING = 'string',
  INTEGER = 'integer',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
}

export type SchemaProcessingResult = DeepReadonly<{
  validationErrors: SchemaValidationError[];
  processedRecord: TypedDataRecord;
}>;

export type BatchProcessingResult = DeepReadonly<{
  validationErrors: SchemaValidationError[];
  processedRecords: TypedDataRecord[];
}>;

export enum SchemaValidationErrorTypes {
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_VALUE_TYPE = 'INVALID_FIELD_VALUE_TYPE',
  INVALID_BY_REGEX = 'INVALID_BY_REGEX',
  INVALID_BY_RANGE = 'INVALID_BY_RANGE',
  INVALID_BY_SCRIPT = 'INVALID_BY_SCRIPT',
  INVALID_ENUM_VALUE = 'INVALID_ENUM_VALUE',
  UNRECOGNIZED_FIELD = 'UNRECOGNIZED_FIELD',
}

export interface SchemaValidationError {
  readonly errorType: SchemaValidationErrorTypes;
  readonly index: number;
  readonly fieldName: string;
  readonly info: Record<string, any>;
  readonly message: string;
}

export interface FieldNamesByPriorityMap {
  required: string[];
  optional: string[];
}

export interface ChangeAnalysis {
  fields: {
    addedFields: AddedFieldChange[];
    renamedFields: string[];
    deletedFields: string[];
  };
  isArrayDesignationChanges: string[];
  restrictionsChanges: RestrictionChanges;
  metaChanges?: MetaChanges;
}

export type RestrictionChanges = {
  range: {
    [key in ChangeTypeName]: ObjectChange[];
  };
  codeList: {
    [key in ChangeTypeName]: ObjectChange[];
  };
  regex: RegexChanges;
  required: RequiredChanges;
  script: ScriptChanges;
};

export type MetaChanges = {
  core: {
    changedToCore: string[]; // fields that are core now
    changedFromCore: string[]; // fields that are not core now
  };
};

export type RegexChanges = {
  [key in ChangeTypeName]: StringAttributeChange[];
};

export type RequiredChanges = {
  [key in ChangeTypeName]: BooleanAttributeChange[];
};

export type ScriptChanges = {
  [key in ChangeTypeName]: StringAttributeChange[];
};

export interface AddedFieldChange {
  name: string;
  definition: FieldDefinition;
}

export interface ObjectChange {
  field: string;
  definition: any;
}

export interface CodeListChange {
  field: string;
  definition: any;
}

export interface StringAttributeChange {
  field: string;
  definition: string;
}

export interface BooleanAttributeChange {
  field: string;
  definition: boolean;
}
