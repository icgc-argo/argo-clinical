import {
  DonorFieldsEnum,
  ClinicalEntitySchemaNames,
  TreatmentFieldsEnum,
} from '../submission-entities';

export type MigrationStage = 'SUBMITTED' | 'ANALYZED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type MigrationState = 'OPEN' | 'CLOSED';

export interface DictionaryMigration {
  _id?: string;
  fromVersion: string;
  toVersion: string;
  state: MigrationState;
  stage: MigrationStage;
  dryRun: boolean;
  analysis: any;
  stats: {
    totalProcessed: number;
    validDocumentsCount: number;
    invalidDocumentsCount: number;
  };
  invalidDonorsErrors: any[];
  checkedSubmissions: any[];
  invalidSubmissions: any[];
  createdBy: string;
}

export const ClinicalEntityFieldRestrictions: { [k: string]: ClinicalFieldRestrictionSpec[] } = {
  [ClinicalEntitySchemaNames.DONOR]: [
    { fieldName: DonorFieldsEnum.vital_status, codeList: ['Deceased'] },
  ],
  [ClinicalEntitySchemaNames.TREATMENT]: [
    { fieldName: TreatmentFieldsEnum.treatment_type, codeList: [] },
  ],
};

export type ClinicalFieldRestrictionSpec = {
  fieldName: string;
  codeList?: string[];
  regex?: RegExp;
};
