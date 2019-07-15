import { loggerFor } from "../logger";
const L = loggerFor(__filename);


export interface DataRecord {
    [k: string]: string;
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
    meta?: { key?: boolean; required?: boolean,  default?: string | number | boolean };
    restrictions?: { codeList?: Array<string>; regex?: string; script?: string };
}

export enum ValueType {
    string = "string", integer = "integer", number = "number", boolean = "boolean"
}

export interface SchemaValidationErrors {
    generalErrors: Array<any>;
    recordsErrors: Array<SchemaValidationError>;
}

export enum ErrorTypes {
    MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
    INVALID_FIELD_VALUE_TYPE= "INVALID_FIELD_VALUE_TYPE",
    INVALID_BY_REGEX = "INVALID_BY_REGEX",
    INVALID_BY_SCRIPT = "INVALID_BY_SCRIPT",
}

export interface SchemaValidationError {
    errorType: ErrorTypes;
    index: number;
    fieldName: string;
}

