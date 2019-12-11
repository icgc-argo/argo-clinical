export interface Donor {
  _id?: string;
  schemaMetadata: SchemaMetadata;
  donorId?: number;
  gender: string;
  submitterId: string;
  programId: string;
  specimens: Array<Specimen>;
  clinicalInfo?: ClinicalInfo;
  primaryDiagnosis?: ClinicalInfo;
  followUps?: Array<FollowUp>;
  treatments?: Array<Treatment>;
}

export interface SchemaMetadata {
  lastMigrationId?: string | undefined | null;
  lastValidSchemaVersion: string;
  originalSchemaVersion: string;
  isValid: boolean;
}

export interface Specimen {
  samples: Array<Sample>;
  specimenTissueSource: string;
  submitterId: string;
  specimenId?: number;
  tumourNormalDesignation: string;
  clinicalInfo?: ClinicalInfo;
}

export interface Sample {
  sampleId?: number;
  sampleType: string;
  submitterId: string;
}

export interface Treatment {
  clinicalInfo?: ClinicalInfo;
  therapies: Array<Therapy>;
}

export interface Therapy {
  clinicalInfo?: ClinicalInfo;
  therapyType: string;
}

export interface FollowUp {
  clinicalInfo: ClinicalInfo;
}

export interface ClinicalInfo {
  [field: string]: string | number | boolean | undefined;
}

export type DonorMap = Readonly<{ [submitterId: string]: Donor }>;
