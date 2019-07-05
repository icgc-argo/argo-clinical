import mongoose from "mongoose";
import { Donor } from "../../../domain/entities/clinical";

type DonorDocument = mongoose.Document & Donor;

const donorSchema = new mongoose.Schema({
    donorId: {type: String, index: true, unique: true},
    gender: {type: String, required: true},
    submitterId: {type: String, index: true, unique: true, required: true},
    programId: {type: String, required: true},
    specimens: Array,
    clinicalInfo: Map,
    primaryDiagnosis: Object,
    followUps: Array,
    treatments: Array,
    chemotherapy: Array,
    HormoneTherapy: Array,
}, { timestamps: true });

donorSchema.pre("save", async function save(next) {
    const newDonor = this as DonorDocument;
    if (!newDonor.isNew) { return next(); }
    try {
    const latestDonor = await DonorModel
        .findOne({}, undefined, { collation : { locale: "en_US", numericOrdering: true }})
        .sort({ "donorId": -1 })
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
