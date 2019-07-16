import { DataSchema } from "../../../domain/entities/submission";
import { DataSchemaModel } from "../../../infra/mongoose/submission/dataschema";
import { loggerFor } from "../../../logger";
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