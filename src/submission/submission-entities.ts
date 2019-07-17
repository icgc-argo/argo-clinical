/**
 * Represents a valid registration that is not yet committed (in progress)
 */
export interface ActiveRegistration {
  id?: string;
  readonly programId: string;
  readonly creator: string;
  readonly records: Array<RegistrationRecord>;
}

export interface RegistrationRecord {
  readonly donorSubmitterId: string;
  readonly gender: string;
  readonly specimenSubmitterId: string;
  readonly specimenType: string;
  readonly tumourNormalDesignation: string;
  readonly sampleSubmitterId: string;
  readonly sampleType: string;
}
