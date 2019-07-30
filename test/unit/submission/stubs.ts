import { Donor } from "../../../src/clinical/clinical-entities";

/**
 * strongly typed stubs file!!
 */
export const stubs = {
  validation: {
    existingDonor01: (): Donor => ({
      _id: "i8321321",
      submitterId: "AB1",
      programId: "PEME-CA",
      donorId: "DO10",
      clinicalInfo: {},
      gender: "Female",
      specimens: [
        {
          submitterId: "SP1",
          specimenType: "XYZ",
          clinicalInfo: {},
          tumourNormalDesignation: "Normal",
          samples: [
            {
              sampleType: "ST1",
              submitterId: "AM1"
            }
          ]
        }
      ]
    })
  }
};
