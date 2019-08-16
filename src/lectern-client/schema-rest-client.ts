import { loggerFor } from "../logger";
import { SchemasDictionary } from "./schema-entities";
const L = loggerFor(__filename);
import stuff from "./stub-schema.json";

export interface SchemaServiceRestClient {
  fetchSchema(schemaSvcUrl: string, name: string, version: string): Promise<SchemasDictionary>;
}

export const schemaClient: SchemaServiceRestClient = {
  fetchSchema: async (
    schemaSvcUrl: string,
    name: string,
    version: string
  ): Promise<SchemasDictionary> => {
    // for testing where we need to work against stub schema
    if (schemaSvcUrl == "http://test/schema") {
      L.debug(`in fetch schema ${version}`);
      const result = delay(1000);
      const stubb = await result(stuff[0] as SchemasDictionary);
      L.debug(`schema found ${stubb.version}`);
      return stubb;
    }

    if (!schemaSvcUrl) {
      throw new Error("please configure a valid url to get schema from");
    }
    const url = `${schemaSvcUrl}/dictionaries?name=${name}&version=${version}`;
    try {
      const schemasDictionaryRes = await fetch(url);
      const schemaDictionary = await schemasDictionaryRes.json();
      // todo validate response and map it to a schema
      return schemaDictionary as SchemasDictionary;
    } catch (err) {
      L.error(`failed to fetch schema using this url: ${url}`, err);
      throw new Error("failed to get the schema");
    }
  }
};

function delay(milliseconds: number) {
  return async (result: SchemasDictionary) => {
    return new Promise<SchemasDictionary>(async (resolve, reject) => {
      setTimeout(() => resolve(result), milliseconds);
    });
  };
}
