import {
  DonorFieldsEnum,
  ClinicalEntitySchemaNames,
  SpecimenFieldsEnum,
  SampleRegistrationFieldsEnum,
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

const commonFields = ['program_id', 'submitter_donor_id'];

export const ClinicalSchemaSpecs: ClinicalEntitySchemaSpecForDataValidation[] = [
  {
    name: ClinicalEntitySchemaNames.REGISTRATION,
    fieldsRequired: Object.values(SampleRegistrationFieldsEnum),
  },
  {
    name: ClinicalEntitySchemaNames.DONOR,
    fieldsRequired: Object.values(DonorFieldsEnum),
    fieldsRestrictions: [{ name: DonorFieldsEnum.vital_status, codeList: ['Deceased'] }],
  },
  {
    name: ClinicalEntitySchemaNames.SPECIMEN,
    fieldsRequired: Object.values(SpecimenFieldsEnum),
  },
];

type ClinicalEntitySchemaSpecForDataValidation = {
  name: ClinicalEntitySchemaNames;
  fieldsRequired: string[];
  fieldsRestrictions?: ClinicalFieldRestrictionSpec[];
};

type ClinicalFieldRestrictionSpec = {
  name: string;
  codeList?: string[];
  // regex?: RegExp;
  // others here?
};
