import { Donor, Sample, Specimen } from "./clinical-entities";
import mongoose = require("mongoose");
import { DeepReadonly } from "deep-freeze";
import { F, MongooseUtils } from "../utils";

export const SUBMITTER_ID = "submitterId";
export const SPECIMEN_SUBMITTER_ID = "specimen.submitterId";
export const SPECIMEN_SAMPLE_SUBMITTER_ID = "specimen.sample.submitterId";

export enum DONOR_FIELDS {
  SUBMITTER_ID = "submitterId",
  SPECIMEN_SUBMITTER_ID = "specimen.submitterId",
  SPECIMEN_SAMPLE_SUBMITTER_ID = "specimen.sample.submitterId",
  PROGRAM_ID = "PROGRAM_ID"
}

export interface DonorRepository {
  findByProgramAndSubmitterId(
    filter: DeepReadonly<{ programId: string; submitterId: string }[]>
  ): Promise<DeepReadonly<Donor[]> | undefined>;
  register(donor: DeepReadonly<RegisterDonorDto>): Promise<DeepReadonly<Donor>>;
  countBy(filter: any): Promise<number>;
}

// Mongoose implementation of the DonorRepository
export const donorDao: DonorRepository = {
  async countBy(filter: any) {
    return await DonorModel.count(filter)
      .lean()
      .exec();
  },
  async findByProgramAndSubmitterId(
    filter: { programId: string; submitterId: string }[]
  ): Promise<DeepReadonly<Donor[]> | undefined> {
    const result = await DonorModel.find({
      $or: [...filter]
    })
      .lean()
      .exec();
    // convert the id to string to avoid runtime error on freezing
    result.forEach((d: DonorDocument) => {
      if (d._id) d._id = d._id.toString();
    });
    return F(result);
  },
  // async update(donor: Donor) {
  //   const model = new DonorModel();
  //   const result = await model.update(donor);
  //   return F(MongooseUtils.toPojo(donor));
  // },
  async register(createDonorDto: DeepReadonly<RegisterDonorDto>) {
    const donor: Donor = {
      donorId: "",
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
          clinicalInfo: {},
          specimenType: s.specimenType,
          tumourNormalDesignation: s.tumourNormalDesignation,
          submitterId: s.submitterId
        };
        return spec;
      }),
      clinicalInfo: {},
      primaryDiagnosis: {},
      followUps: [],
      treatments: [],
      chemotherapy: [],
      HormoneTherapy: []
    };
    const newDonor = new DonorModel(donor);
    await newDonor.save();
    return F(MongooseUtils.toPojo(newDonor));
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
  specimenType: string;
  tumourNormalDesignation: string;
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
    submitterId: { type: String, index: true, required: true },
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

donorSchema.index({ submitterId: 1, programId: 1 }, { unique: true });
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
    const donorNum: number = parseInt(latestDonor.donorId.substring(2));
    newDonor.donorId = "DO" + (donorNum + 1);
    next();
  } catch (err) {
    return next(err);
  }
});

export const DonorModel = mongoose.model<DonorDocument>("Donor", donorSchema);
