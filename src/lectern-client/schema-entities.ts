import { loggerFor } from "../logger";
const L = loggerFor(__filename);

export interface DataRecord {
  readonly [k: string]: string;
}

export interface DataSchema {
  version: string;
  name: string;
  definitions: Array<SchemaDefinition>;
}

export interface SchemaDefinition {
  name: string;
  description: string;
  key: string;
  fields: Array<FieldDefinition>;
}

export interface FieldDefinition {
  name: string;
  valueType: ValueType;
  description: string;
  meta?: { key?: boolean; default?: string | number | boolean };
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
}
