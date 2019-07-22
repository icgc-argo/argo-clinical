import mongoose from "mongoose";
import { SchemasDictionary } from "./schema-entities";
import { loggerFor } from "../logger";
const L = loggerFor(__filename);

export interface SchemaRepository {
  createOrUpdate(schema: SchemasDictionary): Promise<SchemasDictionary | null>;
  get(name: String): Promise<SchemasDictionary | null>;
}

export const schemaRepo: SchemaRepository = {
  createOrUpdate: async (schema: SchemasDictionary): Promise<SchemasDictionary | null> => {
    const newSchema = new DataSchemaModel(schema);
    return await DataSchemaModel.findOneAndUpdate(
      {
        name: schema.name
      },
      newSchema,
      { upsert: true }
    ).exec();
  },
  get: async (name: String): Promise<SchemasDictionary | null> => {
    L.debug("in Schema repo get");
    return await DataSchemaModel.findOne({ name: name }).exec();
  }
};

type DataSchemaDocument = mongoose.Document & SchemasDictionary;

const DataSchemaMongooseSchema = new mongoose.Schema(
  {
    name: { type: String, unique: true },
    version: { type: String },
    definitions: []
  },
  { timestamps: true }
);

export const DataSchemaModel = mongoose.model<DataSchemaDocument>(
  "dataschema",
  DataSchemaMongooseSchema
);
