import { Donor, Sample, Specimen } from "./clinical-entities";
import mongoose from "mongoose";
import { DeepReadonly } from "deep-freeze";
import { F, MongooseUtils, notEmpty } from "../utils";
import { loggerFor } from "../logger";
export const SUBMITTER_ID = "submitterId";
export const SPECIMEN_SUBMITTER_ID = "specimen.submitterId";
export const SPECIMEN_SAMPLE_SUBMITTER_ID = "specimen.sample.submitterId";
const L = loggerFor(__filename);

const AutoIncrement = require("mongoose-sequence")(mongoose);

export enum DONOR_FIELDS {
  SUBMITTER_ID = "submitterId",
  DONOR_ID = "donorId",
  SPECIMEN_SUBMITTER_ID = "specimens.submitterId",
  SPECIMEN_SAMPLE_SUBMITTER_ID = "specimens.samples.submitterId",
  PROGRAM_ID = "programId"
}

export type FindByProgramAndSubmitterFilter = DeepReadonly<{
  programId: string;
  submitterId: string;
}>;
export interface DonorRepository {
  findByProgramId(programId: string): Promise<DeepReadonly<Donor[]>>;
  findByProgramAndSubmitterId(
    filters: DeepReadonly<FindByProgramAndSubmitterFilter[]>
  ): Promise<DeepReadonly<Donor[]> | undefined>;
  create(donor: DeepReadonly<Donor>): Promise<DeepReadonly<Donor>>;
  update(donor: DeepReadonly<Donor>): Promise<DeepReadonly<Donor>>;
  countBy(filter: any): Promise<number>;
}

// Mongoose implementation of the DonorRepository
export const donorDao: DonorRepository = {
  async countBy(filter: any) {
    return await DonorModel.count(filter).exec();
  },

  async findByProgramId(programId: string): Promise<DeepReadonly<Donor[]>> {
    const result = await DonorModel.find(
      {
        [DONOR_FIELDS.PROGRAM_ID]: programId
      },
      undefined,
      { sort: { [DONOR_FIELDS.DONOR_ID]: 1 } }
    ).exec();
    // convert the id to string to avoid runtime error on freezing
    const mapped = result
      .map((d: DonorDocument) => {
        return MongooseUtils.toPojo(d);
      })
      .filter(notEmpty);
    return F(mapped);
  },

  async findByProgramAndSubmitterId(
    filter: { programId: string; submitterId: string }[]
  ): Promise<DeepReadonly<Donor[]> | undefined> {
    const result = await DonorModel.find({
      $or: [...filter]
    }).exec();
    // convert the id to string to avoid runtime error on freezing
    const mapped = result.map((d: DonorDocument) => {
      return MongooseUtils.toPojo(d);
    });
    return F(mapped);
  },

  async update(donor: DeepReadonly<Donor>) {
    const newDonor = new DonorModel(donor);
    newDonor.isNew = false;
    newDonor.specimens.forEach(sp => {
      if (sp.specimenId) {
        (sp as any).isNew = false;
      }

      sp.samples.forEach(sa => {
        if (sa.sampleId) {
          (sa as any).isNew = false;
        }
      });
    });
    await newDonor.save();
    return F(MongooseUtils.toPojo(newDonor));
  },

  async create(donor: DeepReadonly<Donor>) {
    const newDonor = new DonorModel(donor);
    await newDonor.save();
    return F(MongooseUtils.toPojo(newDonor));
  }
};

type DonorDocument = mongoose.Document & Donor;

const SampleSchema = new mongoose.Schema(
  {
    sampleId: { type: Number, index: true, unique: true, get: prefixSampleId },
    sampleType: { type: String },
    submitterId: { type: String, index: true, required: true }
  },
  { _id: false }
);

SampleSchema.plugin(AutoIncrement, { inc_field: "sampleId" });

const SpecimenSchema = new mongoose.Schema(
  {
    specimenId: { type: Number, index: true, unique: true, get: prefixSpecimenId },
    specimenType: { type: String },
    clinicalInfo: {},
    tumourNormalDesignation: String,
    submitterId: { type: String, index: true, required: true },
    samples: [SampleSchema]
  },
  { _id: false }
);
SpecimenSchema.plugin(AutoIncrement, { inc_field: "specimenId" });

const DonorSchema = new mongoose.Schema(
  {
    donorId: { type: Number, index: true, unique: true, get: prefixDonorId },
    gender: { type: String, required: true },
    submitterId: { type: String, index: true, required: true },
    programId: { type: String, required: true },
    specimens: [SpecimenSchema],
    clinicalInfo: {},
    primaryDiagnosis: {},
    followUps: Array,
    treatments: Array,
    chemotherapy: Array,
    HormoneTherapy: Array
  },
  { timestamps: true }
);

function prefixDonorId(id: any) {
  if (!id) return undefined;
  return `DO${id}`;
}

function prefixSpecimenId(id: any) {
  if (!id) return undefined;
  return `SP${id}`;
}

function prefixSampleId(id: any) {
  if (!id) return undefined;
  return `SA${id}`;
}

DonorSchema.plugin(AutoIncrement, { inc_field: "donorId" });
DonorSchema.index({ submitterId: 1, programId: 1 }, { unique: true });

export const DonorModel = mongoose.model<DonorDocument>("Donor", DonorSchema);
