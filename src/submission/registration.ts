import mongoose from "mongoose";
import { ActiveRegistration } from "./submission-entities";

type ActiveRegistrationDocument = mongoose.Document & ActiveRegistration;

const ActiveRegistrationItem = new mongoose.Schema(
  {
    donorSubmitterId: { type: String, required: true },
    gender: { type: String, required: true },
    specimenSubmitterId: { type: String, required: true },
    specimenType: { type: String, required: true },
    tumorNormalDesignation: { type: String, required: true },
    sampleSubmitterId: { type: String, required: true },
    sampleType: { type: String, required: true }
  },
  { _id: false }
);

const ActiveRegistrationSchema = new mongoose.Schema(
  {
    programId: { type: String, unique: true, required: true },
    creator: { type: String },
    records: [ActiveRegistrationItem]
  },
  { timestamps: true }
);

export const ActiveRegistrationModel = mongoose.model<ActiveRegistrationDocument>(
  "ActiveRegistration",
  ActiveRegistrationSchema
);
