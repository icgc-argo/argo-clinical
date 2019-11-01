export type MigrationStage = 'SUBMITTED' | 'ANALYZED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type MigrationState = 'OPEN' | 'CLOSED';

export interface DictionaryMigration {
  _id?: string;
  fromVersion: string;
  toVersion: string;
  state: MigrationState;
  stage: MigrationStage;
  analysis: any;
}
