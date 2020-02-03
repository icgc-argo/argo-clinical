export interface Donor {
  _id?: string;
  schemaMetadata: SchemaMetadata;
  donorId?: number;
  gender: string;
  submitterId: string;
  programId: string;
  specimens: Array<Specimen>;
  clinicalInfo?: ClinicalInfo;
  clinicalInfoStats?: ClinicalEntityStats;
  primaryDiagnosis?: ClinicalEntity | undefined;
  followUps?: Array<FollowUp>;
  treatments?: Array<Treatment>;
  createdAt?: string;
  updatedAt?: string;
  totalStats?: DonorStats;
}

export interface DonorStats {
  totalCoreFields: number;
  totalExtendedFields: number;
  // normalSamples: number;
  // tumourSamples: number;
}

export interface ClinicalEntityStats {
  coreFields: number;
  extendedFields: number;
}

export interface SchemaMetadata {
  lastMigrationId?: string | undefined | null;
  lastValidSchemaVersion: string;
  originalSchemaVersion: string;
  isValid: boolean;
}

export type ClinicalEntity = {
  clinicalInfo: ClinicalInfo;
  clinicalInfoStats?: ClinicalEntityStats;
  [k: string]: any;
};

export interface Specimen extends ClinicalEntity {
  samples: Array<Sample>;
  specimenTissueSource: string;
  submitterId: string;
  specimenId?: number;
  tumourNormalDesignation: string;
  specimenType: string;
}

export interface Sample {
  sampleId?: number;
  sampleType: string;
  submitterId: string;
}

export interface Treatment extends ClinicalEntity {
  therapies: Array<Therapy>;
}

export interface Therapy extends ClinicalEntity {
  therapyType: string;
}

export interface FollowUp extends ClinicalEntity {}

export interface ClinicalInfo {
  [field: string]: string | number | boolean | undefined;
}

export type DonorMap = Readonly<{ [submitterId: string]: Donor }>;
