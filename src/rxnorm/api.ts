export interface RxNormService {
  lookupByRxcui(rxcui: string): Promise<RxNormConcept[]>;
}

// https://www.nlm.nih.gov/research/umls/rxnorm/docs/techdoc.html
export interface RxNormConcept {
  // RXCUI field
  rxcui: string;
  // STR field
  str: string;
}
