/**
 * Represents a valid registration that is not yet committed (in progress)
 */
export interface ActiveRegistration {
    id?: string;
    programId: string;
    creator: string;
    records: Array<RegistrationRecord>;
}

export interface RegistrationRecord {
    donorSubmitterId: string;
    gender: string;
    specimenSubmitterId: string;
    specimenType: string;
    tumorNormalDesignation: string;
    sampleSubmitterId: string;
    sampleType: string;
}
