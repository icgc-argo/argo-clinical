import { loggerFor } from "../logger";
import { SchemasDictionary } from "./schema-entities";
const L = loggerFor(__filename);
import stuff from "./stub-schema.json";

export interface SchemaServiceRestClient {
  fetchSchema(name: string, version: string): Promise<SchemasDictionary>;
}

export const schemaClient: SchemaServiceRestClient = {
  fetchSchema: async (name: string, version: string): Promise<SchemasDictionary> => {
    L.debug(`in fetch schema ${version}`);
    const result = delay(1000);
    const stubb = await result(stuff[0]);
    L.debug(`schema found ${stubb.version}`);
    return stubb;
  }
};

function delay(milliseconds: number) {
  return async (result: SchemasDictionary) => {
    return new Promise<SchemasDictionary>(async (resolve, reject) => {
      setTimeout(() => resolve(result), milliseconds);
    });
  };
}
