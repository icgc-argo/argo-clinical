export interface Donor {
    donorId: string;
    gender: string;
    submitterId: string;
    programId: string;
    specimens: Array<Specimen>;
    clinicalInfo: object;
    primaryDiagnosis: object;
    followUps: Array<object>;
    treatments: Array<object>;
    chemotherapy: Array<Object>;
    HormoneTherapy: Array<Object>;
}

export interface Specimen {
    samples: Array<Sample>;
    submitterId: string;
    clinicalInfo: object;
}

export interface Sample {
    sampleType: string;
    submitterId: string;
}
