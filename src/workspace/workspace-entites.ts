export enum SUBMISSION_STATE {
  OPEN = "OPEN",
  VALID = "VALID",
  INVALID = "INVALID",
  PENDING_APPROVAL = "PENDING_APPROVAL"
}

export interface ActiveSubmission {
  programId: String;
  state: SUBMISSION_STATE;
  hashVersion: String;
  clinicalEntities: Object;
}
