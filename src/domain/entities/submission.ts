
/**
 * Represents a valid registration that is not yet committed (in progress)
 */
export interface ActiveRegistration {
    id?: string;
    programId: string;
    creator: string;
    records: Array<RegistrationRecord>;
}

export interface RegistrationRecord {
    donorSubmitterId: string;
    gender: string;
    specimenSubmitterId: string;
    specimenType: string;
    tumorNormalDesignation: string;
    sampleSubmitterId: string;
    sampleType: string;
}

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