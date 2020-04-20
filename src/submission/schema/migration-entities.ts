import { SchemaValidationError } from '../../lectern-client/schema-entities';

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
  programsWithDonorUpdates: string[];
  createdBy: string;
  newSchemaErrors?: NewSchemaVerificationResult;
}

export type NewSchemaVerificationResult = {
  [clinicalEntity: string]: {
    missingFields?: string[];
    invalidFieldCodeLists?: { fieldName: string; missingCodeListValue: string[] }[];
    // invalidFieldRegex?: { name: string; expectedRegex: RegExp };
  };
};

export type DonorMigrationSchemaErrors = Array<{
  [clinicalType: string]: ReadonlyArray<SchemaValidationError>;
}>;
