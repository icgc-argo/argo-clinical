export interface Donor {
  _id?: string;
  donorId?: number;
  gender: string;
  submitterId: string;
  programId: string;
  specimens: Array<Specimen>;
  clinicalInfo?: { [feild: string]: string | number };
  primaryDiagnosis?: object;
  followUps?: Array<object>;
  treatments?: Array<object>;
  chemotherapy?: Array<Object>;
  HormoneTherapy?: Array<Object>;
}

export interface DonorSubEntity {
  submitterId: string;
}

export interface Specimen extends DonorSubEntity {
  samples: Array<Sample>;
  specimenType: string;
  specimenId?: number;
  tumourNormalDesignation: string;
  clinicalInfo?: { [feild: string]: string | number };
}

export interface Sample extends DonorSubEntity {
  sampleId?: number;
  sampleType: string;
}

export type DonorMap = Readonly<{ [submitterId: string]: Donor }>;
