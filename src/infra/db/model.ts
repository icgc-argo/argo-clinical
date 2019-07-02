import mongoose from "mongoose";
import { Donor } from "../../domain/clinical/entities";

export type DonorDocument = mongoose.Document & Donor;

const DonorSchema = new mongoose.Schema({

});

export const DonorModel = mongoose.model<DonorDocument>("Donor", DonorSchema);