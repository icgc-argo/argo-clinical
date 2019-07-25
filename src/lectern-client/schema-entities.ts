import { loggerFor } from "../logger";
const L = loggerFor(__filename);

export class DataRecord {
  readonly [k: string]: string;
}

export class TypedDataRecord {
  readonly [k: string]: SchemaTypes;
}

export type SchemaTypes = string | boolean | number;

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
  STRING = "string",
  INTEGER = "integer",
  NUMBER = "number",
  BOOLEAN = "boolean"
}

export interface SchemaValidationErrors {
  readonly generalErrors: ReadonlyArray<Readonly<any>>;
  readonly recordsErrors: ReadonlyArray<SchemaValidationError>;
}

export enum ErrorTypes {
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_FIELD_VALUE_TYPE = "INVALID_FIELD_VALUE_TYPE",
  INVALID_BY_REGEX = "INVALID_BY_REGEX",
  INVALID_BY_SCRIPT = "INVALID_BY_SCRIPT",
  INVALID_ENUM_VALUE = "INVALID_ENUM_VALUE"
}

export interface SchemaValidationError {
  readonly errorType: ErrorTypes;
  readonly index: number;
  readonly fieldName: string;
  // todo add server message for script validation.
}
