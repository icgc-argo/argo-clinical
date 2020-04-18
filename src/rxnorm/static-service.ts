const ds = [
  {
    rxcui: 3041,
    str: 'Cytarabine',
  },
  {
    rxcui: 240416,
    str: 'cytarabine 20 mg/mL INJECTION VIAL (ML)',
  },
  {
    rxcui: 968804,
    str: 'cytarabine liposomal',
  },
];

export function lookupByRxcui(rxcui: number) {
  return ds.find(rx => rx.rxcui == rxcui);
}

export function lookupByStr(str: string) {
  return ds.find(rx => rx.str == str);
}
