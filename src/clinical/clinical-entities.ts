import { DeepReadonly } from 'deep-freeze';

export interface Donor {
  _id?: string;
  schemaMetadata: SchemaMetadata;
  donorId?: number;
  gender: string;
  submitterId: string;
  programId: string;
  specimens: Array<Specimen>;
  clinicalInfo?: ClinicalInfo;
  primaryDiagnosis?: ClinicalEntity | undefined;
  followUps?: Array<FollowUp>;
  treatments?: Array<Treatment>;
  createdAt?: string;
  updatedAt?: string;
  aggregatedInfoStats?: AggregateClinicalInfoStats;
}

export interface AggregateClinicalInfoStats {
  coreEntitiesStats: CoreEntitiesStats;
  overriddenCoreEntities: string[];
}

export interface SchemaMetadata {
  lastMigrationId?: string | undefined | null;
  lastValidSchemaVersion: string;
  originalSchemaVersion: string;
  isValid: boolean;
}

export type ClinicalEntity = {
  clinicalInfo: ClinicalInfo;
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

export type DonorBySubmitterIdMap = { [k: string]: DeepReadonly<Donor> };

export type CoreEntitiesStats = {
  donor: number;
  specimen: number;
  primary_diagnosis: number;
  follow_up: number;
  treatment: number;
};

export type CoreClinicalEntites = keyof CoreEntitiesStats;
