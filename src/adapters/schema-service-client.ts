import { loggerFor } from "../logger";
import { DataSchema } from "../domain/entities/submission";
const L = loggerFor(__filename);
const stuff = require("../resources/stub-schema.json");

export interface SchemaServiceClient {
  fetchSchema(version: string): Promise<DataSchema>;
}

export const schemaClient: SchemaServiceClient = {
  fetchSchema: async (version: string): Promise<DataSchema> => {
    L.debug(`in fetch schema ${version}`);
    const result = delay(1000);
    const stubb = await result((stuff[0]));
    L.debug(`schema found ${stubb.version}`);
    return stubb;
  }
};

function delay(milliseconds: number) {
    return async (result: DataSchema) => {
      return new Promise<DataSchema>(async (resolve, reject) => {
        setTimeout(() => resolve(result), milliseconds);
      });
    };
  }
