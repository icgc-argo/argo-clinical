export interface ClinicalChild {
  submitterId: string;
}

export interface Donor {
  _id?: string;
  donorId?: number;
  gender: string;
  submitterId: string;
  programId: string;
  specimens: Array<Specimen>;
  clinicalInfo?: object;
  primaryDiagnosis?: object;
  followUps?: Array<object>;
  treatments?: Array<object>;
  chemotherapy?: Array<Object>;
  HormoneTherapy?: Array<Object>;
}

export interface Specimen extends ClinicalChild {
  samples: Array<Sample>;
  specimenType: string;
  specimenId?: number;
  tumourNormalDesignation: string;
  clinicalInfo?: object;
}

export interface Sample extends ClinicalChild {
  sampleId?: number;
  sampleType: string;
}

export type DonorMap = Readonly<{ [submitterId: string]: Donor }>;
