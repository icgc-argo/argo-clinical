import { Donor, Sample, Specimen } from "./clinical-entities";
import mongoose from "mongoose";
import { DeepReadonly } from "deep-freeze";
import { F, MongooseUtils } from "../utils";
export const SUBMITTER_ID = "submitterId";
export const SPECIMEN_SUBMITTER_ID = "specimen.submitterId";
export const SPECIMEN_SAMPLE_SUBMITTER_ID = "specimen.sample.submitterId";

const AutoIncrement = require("mongoose-sequence")(mongoose);

export enum DONOR_FIELDS {
  SUBMITTER_ID = "submitterId",
  SPECIMEN_SUBMITTER_ID = "specimen.submitterId",
  SPECIMEN_SAMPLE_SUBMITTER_ID = "specimen.sample.submitterId",
  PROGRAM_ID = "PROGRAM_ID"
}

export type FindByProgramAndSubmitterFilter = DeepReadonly<{
  programId: string;
  submitterId: string;
}>;
export interface DonorRepository {
  findByProgramAndSubmitterId(
    filters: DeepReadonly<FindByProgramAndSubmitterFilter[]>
  ): Promise<DeepReadonly<Donor[]> | undefined>;
  create(donor: DeepReadonly<CreateDonorDto>): Promise<DeepReadonly<Donor>>;
  update(donor: Donor): Promise<DeepReadonly<Donor>>;
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
    const mapped = result.map((d: DonorDocument) => {
      return MongooseUtils.toPojo(d);
    });
    return F(mapped);
  },

  async update(donor: Donor) {
    const model = new DonorModel();
    const result = await model.update(donor);
    return F(MongooseUtils.toPojo(result));
  },

  async create(createDonorDto: DeepReadonly<CreateDonorDto>) {
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

export interface CreateDonorDto {
  gender: string;
  submitterId: string;
  programId: string;
  specimens: Array<CreateSpecimenDto>;
}

export interface CreateSpecimenDto {
  samples: Array<CreateSampleDto>;
  specimenType: string;
  tumourNormalDesignation: string;
  submitterId: string;
}

export interface CreateSampleDto {
  sampleType: string;
  submitterId: string;
}

type DonorDocument = mongoose.Document & Donor;

const SampleSchema = new mongoose.Schema(
  {
    sampleId: { type: Number, index: true, unique: true, get: prefixSampleId, immutable: true },
    sampleType: { type: String },
    submitterId: { type: String, index: true, required: true }
  },
  { _id: false }
);

SampleSchema.plugin(AutoIncrement, { inc_field: "sampleId" });

const SpecimenSchema = new mongoose.Schema(
  {
    specimenId: { type: Number, index: true, unique: true, get: prefixSpecimenId, immutable: true },
    specimenType: { type: String },
    clinicalInfo: Object,
    tumourNormalDesignation: String,
    submitterId: { type: String, index: true, required: true },
    samples: [SampleSchema]
  },
  { _id: false }
);
SpecimenSchema.plugin(AutoIncrement, { inc_field: "specimenId" });

const DonorSchema = new mongoose.Schema(
  {
    donorId: { type: Number, index: true, unique: true, get: prefixDonorId, immutable: true },
    gender: { type: String, required: true },
    submitterId: { type: String, index: true, required: true },
    programId: { type: String, required: true },
    specimens: [SpecimenSchema],
    clinicalInfo: Map,
    primaryDiagnosis: Object,
    followUps: Array,
    treatments: Array,
    chemotherapy: Array,
    HormoneTherapy: Array
  },
  { timestamps: true }
);

function prefixDonorId(id: any) {
  return `DO${id}`;
}

function prefixSpecimenId(id: any) {
  return `SP${id}`;
}

function prefixSampleId(id: any) {
  return `SA${id}`;
}

DonorSchema.plugin(AutoIncrement, { inc_field: "donorId" });
DonorSchema.index({ submitterId: 1, programId: 1 }, { unique: true });

// donorSchema.pre("save", async function save(next) {
//   const newDonor = this as DonorDocument;
//   if (!newDonor.isNew) {
//     return next();
//   }
//   try {
//     const latestDonor = await DonorModel.findOne({}, undefined, {
//       collation: { locale: "en_US", numericOrdering: true }
//     })
//       .sort({ donorId: -1 })
//       .exec();
//     if (latestDonor == undefined) {
//       newDonor.donorId = "DO" + 1;
//       return next();
//     }
//     const donorNum: number = parseInt(latestDonor.donorId.substring(2));
//     newDonor.donorId = "DO" + (donorNum + 1);
//     next();
//   } catch (err) {
//     return next(err);
//   }
// });

export const DonorModel = mongoose.model<DonorDocument>("Donor", DonorSchema);
