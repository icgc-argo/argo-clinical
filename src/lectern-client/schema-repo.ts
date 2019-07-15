import mongoose from "mongoose";
import { DataSchema } from "./schema-entities";
import { loggerFor } from "../logger";
const L = loggerFor(__filename);

export interface SchemaRepository {
    createOrUpdate(schema: DataSchema): Promise<DataSchema>;
    get(): Promise<DataSchema>;
}

export const schemaRepo: SchemaRepository = {
    createOrUpdate: async(schema: DataSchema): Promise<DataSchema> => {
        const newSchema = new DataSchemaModel(schema);
        return await DataSchemaModel.findOneAndUpdate({
            name: "ARGO"
        }, newSchema, { upsert: true }).exec();
    },
    get: async (): Promise<DataSchema> => {
        L.debug("in Schema repo get");
        return await DataSchemaModel.findOne({ name: "ARGO" }).exec();
    },
};

type DataSchemaDocument = mongoose.Document & DataSchema;

const DataSchemaMongooseSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    version: { type: String },
    definitions: [],
}, { timestamps: true });


export const DataSchemaModel = mongoose.model<DataSchemaDocument>("dataschema", DataSchemaMongooseSchema);
