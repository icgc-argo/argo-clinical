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
}
