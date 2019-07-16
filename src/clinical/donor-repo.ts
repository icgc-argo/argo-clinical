import { Donor, Sample, Specimen } from "./clinical-entities";
import mongoose from "mongoose";

export interface DonorRepository {
  register(donor: RegisterDonorDto): Promise<Donor>;
}

// Mongoose implementation of the DonorRepository
export const donorDao: DonorRepository = {
  async register(createDonorDto: RegisterDonorDto): Promise<Donor> {
    const donor: Donor = {
      donorId: undefined,
      gender: createDonorDto.gender,
      submitterId: createDonorDto.submitterId,
      programId: createDonorDto.programId,
      specimens: createDonorDto.specimens.map(s => {
        const spec: Specimen = {
          samples: s.samples.map(sa => {
            const sample: Sample = {
              sampleType: sa.sampleType,
              submitterId: sa.submitterId
            };
            return sample;
          }),
          clinicalInfo: undefined,
          submitterId: s.submitterId
        };
        return spec;
      }),
      clinicalInfo: undefined,
      primaryDiagnosis: undefined,
      followUps: undefined,
      treatments: undefined,
      chemotherapy: undefined,
      HormoneTherapy: undefined
    };
    const newDonor = new DonorModel(donor);
    await newDonor.save();
    return newDonor;
  }
};

export interface RegisterDonorDto {
  gender: string;
  submitterId: string;
  programId: string;
  specimens: Array<RegisterSpecimenDto>;
}

export interface RegisterSpecimenDto {
  samples: Array<RegisterSampleDto>;
  submitterId: string;
}

export interface RegisterSampleDto {
  sampleType: string;
  submitterId: string;
}

type DonorDocument = mongoose.Document & Donor;

const donorSchema = new mongoose.Schema(
  {
    donorId: { type: String, index: true, unique: true },
    gender: { type: String, required: true },
    submitterId: { type: String, index: true, unique: true, required: true },
    programId: { type: String, required: true },
    specimens: Array,
    clinicalInfo: Map,
    primaryDiagnosis: Object,
    followUps: Array,
    treatments: Array,
    chemotherapy: Array,
    HormoneTherapy: Array
  },
  { timestamps: true }
);

donorSchema.pre("save", async function save(next) {
  const newDonor = this as DonorDocument;
  if (!newDonor.isNew) {
    return next();
  }
  try {
    const latestDonor = await DonorModel.findOne({}, undefined, {
      collation: { locale: "en_US", numericOrdering: true }
    })
      .sort({ donorId: -1 })
      .exec();
    if (latestDonor == undefined) {
      newDonor.donorId = "DO" + 1;
      return next();
    }
    const donorNum: number = parseInt(latestDonor.donorId.substring(0, 2));
    newDonor.donorId = "DO" + (donorNum + 1);
    next();
  } catch (err) {
    return next(err);
  }
});

export const DonorModel = mongoose.model<DonorDocument>("Donor", donorSchema);
