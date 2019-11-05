import { loggerFor } from '../logger';
import { DeepReadonly } from 'deep-freeze';
const L = loggerFor(__filename);

export class DataRecord {
  readonly [k: string]: string;
}

export class TypedDataRecord {
  readonly [k: string]: SchemaTypes;
}

export type SchemaTypes = string | boolean | number | undefined;

export interface SchemasDictionary {
  version: string;
  name: string;
  schemas: Array<SchemaDefinition>;
}

export interface SchemaDefinition {
  readonly name: string;
  readonly description: string;
  readonly key: string;
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

export interface Change {
  type: 'created' | 'deleted' | 'updated';
  data: any;
}

export interface FieldDefinition {
  name: string;
  valueType: ValueType;
  description: string;
  meta?: { key?: boolean; default?: SchemaTypes };
  restrictions?: {
    codeList?: Array<string | number>;
    regex?: string;
    script?: string;
    required?: boolean;
  };
}

export enum ValueType {
  STRING = 'string',
  INTEGER = 'integer',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
}

export type SchemaProcessingResult = DeepReadonly<{
  validationErrors: SchemaValidationError[];
  processedRecords: TypedDataRecord[];
}>;

export enum SchemaValidationErrorTypes {
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_VALUE_TYPE = 'INVALID_FIELD_VALUE_TYPE',
  INVALID_BY_REGEX = 'INVALID_BY_REGEX',
  INVALID_BY_SCRIPT = 'INVALID_BY_SCRIPT',
  INVALID_ENUM_VALUE = 'INVALID_ENUM_VALUE',
  UNRECOGNIZED_FIELD = 'UNRECOGNIZED_FIELD',
}

export interface SchemaValidationError {
  readonly errorType: SchemaValidationErrorTypes;
  readonly index: number;
  readonly fieldName: string;
  readonly info: object;
  readonly message: string;
}

export interface FieldNamesByPriorityMap {
  required: string[];
  optional: string[];
}

export interface ChangeAnalysis {
  fields: {
    addedFields: string[];
    renamedFields: string[];
    deletedFields: string[];
  };
  restrictionsChanges: {
    codeLists: {
      created: CodeListChange[];
      deleted: CodeListChange[];
      updated: CodeListChange[];
    };
  };
}

export interface CodeListChange {
  field: string;
  addition: SchemaTypes[];
  deletion: SchemaTypes[];
}
