import { loggerFor } from "../logger";
const L = loggerFor(__filename);

export interface DataSchema {
    version: string;
    definitions: Array<SchemaDefinition>;
}

export interface SchemaDefinition {
    name: string;
    description: string;
    key: string;
    fields: Array<FieldDefinition>;

}

export enum ValueType {
    string = "string", integer = "integer", number = "number", boolean = "boolean"
}
export interface FieldDefinition {
    name: string;
    valueType: ValueType;
    description: string;
    meta?: { key?: boolean; required?: { default: string | number | boolean } };
    restrictions?: { codeList?: Array<string>; regex?: string; script?: string };
}


