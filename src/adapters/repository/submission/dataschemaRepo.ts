import { DataSchema } from "../../../domain/entities/submission";
import { DataSchemaModel } from "../../../infra/mongoose/submission/dataschema";
export interface SchemaRepository {
    save(schema: DataSchema): void;
    update(schema: DataSchema): void;
    get(): Promise<DataSchema>;
}

export const schemaRepo: SchemaRepository = {
    save: (schema: DataSchema): void => {

    },
    update: (schema: DataSchema): void => {

    },
    get: async (): Promise<DataSchema> => {
        return await DataSchemaModel.findOne({ name: "ARGO" }).exec();
    },
};