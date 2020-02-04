export interface Donor {
  _id?: string;
  schemaMetadata: SchemaMetadata;
  donorId?: number;
  gender: string;
  submitterId: string;
  programId: string;
  specimens: Array<Specimen>;
  clinicalInfo?: ClinicalInfo;
  clinicalStats?: ClinicalStats;
  primaryDiagnosis?: ClinicalObject | undefined;
  followUps?: Array<FollowUp>;
  treatments?: Array<Treatment>;
  createdAt?: string;
  updatedAt?: string;
  aggregatedStats?: AggregateDonorStats;
}

export interface AggregateDonorStats {
  submittedCoreFields: number;
  submittedExtendedFields: number;
  availableCoreFields: number;
  availableExtendedFields: number;
  // normalSamples: number;
  // tumourSamples: number;
}

export interface ClinicalStats {
  submittedCoreFields: number;
  submittedExtendedFields: number;
  availableCoreFields: number;
  availableExtendedFields: number;
}

export interface SchemaMetadata {
  lastMigrationId?: string | undefined | null;
  lastValidSchemaVersion: string;
  originalSchemaVersion: string;
  isValid: boolean;
}

export type ClinicalObject = {
  clinicalInfo: ClinicalInfo;
  clinicalStats?: ClinicalStats;
  [k: string]: any;
};

export interface Specimen extends ClinicalObject {
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

export interface Treatment extends ClinicalObject {
  therapies: Array<Therapy>;
}

export interface Therapy extends ClinicalObject {
  therapyType: string;
}

export interface FollowUp extends ClinicalObject {}

export interface ClinicalInfo {
  [field: string]: string | number | boolean | undefined;
}

export type DonorMap = Readonly<{ [submitterId: string]: Donor }>;
