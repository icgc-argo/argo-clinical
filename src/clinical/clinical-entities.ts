export interface Donor {
  _id?: string;
  donorId: string;
  gender: string;
  submitterId: string;
  programId: string;
  specimens: Array<Specimen>;
  clinicalInfo: object | undefined;
  primaryDiagnosis: object;
  followUps: Array<object>;
  treatments: Array<object>;
  chemotherapy: Array<Object>;
  HormoneTherapy: Array<Object>;
}

export interface Specimen {
  samples: Array<Sample>;
  specimenType: string;
  submitterId: string;
  tumourNormalDesignation: string;
  clinicalInfo: object | undefined;
}

export interface Sample {
  sampleType: string;
  submitterId: string;
}

export type DonorMap = Readonly<{ [submitterId: string]: Donor }>;
