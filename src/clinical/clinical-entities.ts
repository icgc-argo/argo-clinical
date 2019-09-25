export interface Donor {
  _id?: string;
  donorId?: number;
  gender: string;
  submitterId: string;
  programId: string;
  specimens: Array<Specimen>;
  clinicalInfo?: { [field: string]: string | number };
  primaryDiagnosis?: object;
  followUps?: Array<object>;
  treatments?: Array<object>;
  chemotherapy?: Array<Object>;
  HormoneTherapy?: Array<Object>;
}

export interface Specimen {
  samples: Array<Sample>;
  specimenType: string;
  submitterId: string;
  specimenId?: number;
  tumourNormalDesignation: string;
  clinicalInfo?: { [field: string]: string | number };
}

export interface Sample {
  sampleId?: number;
  sampleType: string;
  submitterId: string;
}

export type DonorMap = Readonly<{ [submitterId: string]: Donor }>;
