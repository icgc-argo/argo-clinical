import mongoose from "mongoose";
import { DataSchema } from "../../../domain/entities/submission";

type DataSchemaDocument = mongoose.Document & DataSchema;

const DataSchemaMongooseSchema = new mongoose.Schema({
    name: {type: String, unique: true},
    version: {type: String},
    definitions: [],
}, { timestamps: true });


export const DataSchemaModel = mongoose.model<DataSchemaDocument>("dataschema", DataSchemaMongooseSchema);
