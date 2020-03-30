import mongoose from 'mongoose';
import { SchemasDictionary } from '../../lectern-client/schema-entities';
import { loggerFor } from '../../logger';
import { MongooseUtils } from '../../utils';
const L = loggerFor(__filename);

export interface SchemaRepository {
  createOrUpdate(schema: SchemasDictionary): Promise<SchemasDictionary | undefined>;
  get(name: String): Promise<SchemasDictionary | undefined>;
}

export const schemaRepo: SchemaRepository = {
  createOrUpdate: async (schema: SchemasDictionary): Promise<SchemasDictionary | undefined> => {
    const result = await DataSchemaModel.findOneAndUpdate(
      {
        name: schema.name,
      },
      {
        name: schema.name,
        version: schema.version,
        schemas: schema.schemas,
      },
      { upsert: true, new: true },
    ).exec();

    const resultObj = MongooseUtils.toPojo(result);
    return resultObj;
  },
  get: async (name: String): Promise<SchemasDictionary | undefined> => {
    L.debug('in Schema repo get');
    const doc = await DataSchemaModel.findOne({ name: name }).exec();
    if (!doc) {
      return undefined;
    }
    return MongooseUtils.toPojo(doc);
  },
};

type DataSchemaDocument = mongoose.Document & SchemasDictionary;

const DataSchemaMongooseSchema = new mongoose.Schema(
  {
    name: { type: String, unique: true },
    version: { type: String, required: true },
    schemas: [],
  },
  { timestamps: true },
);

export const DataSchemaModel = mongoose.model<DataSchemaDocument>(
  'dataschema',
  DataSchemaMongooseSchema,
);
