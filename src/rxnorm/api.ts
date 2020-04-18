export interface RxNormService {
  lookupByRxcui(rxcui: number): Promise<RxNormConcept | undefined>;
  lookupByStr(str: string): Promise<RxNormConcept | undefined>;
}

// https://www.nlm.nih.gov/research/umls/rxnorm/docs/techdoc.html
export interface RxNormConcept {
  // RXCUI field
  rxcui: number;
  // STR field
  str: string;
}
