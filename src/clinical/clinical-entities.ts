export interface Donor {
  _id?: string;
  schemaMetadata?: SchemaMetadata;
  donorId?: number;
  gender: string;
  submitterId: string;
  programId: string;
  specimens: Array<Specimen>;
  clinicalInfo?: { [field: string]: string | number };
  primaryDiagnosis?: object;
  followUps?: Array<object>;
  treatments?: Array<object>;
  chemotherapy?: Array<Object>;
  hormoneTherapy?: Array<Object>;
}

export interface SchemaMetadata {
  lastMigrationId: string | undefined;
  currentSchemaVersion: string;
  originalSchemaVersion: string;
  isValid: boolean;
}

export interface Specimen {
  samples: Array<Sample>;
  specimenTissueSource: string;
  submitterId: string;
  specimenId?: number;
  tumourNormalDesignation: string;
  clinicalInfo?: { [field: string]: string | number };
}

export interface Sample {
  sampleId?: number;
  sampleType: string;
  submitterId: string;
}

export type DonorMap = Readonly<{ [submitterId: string]: Donor }>;
