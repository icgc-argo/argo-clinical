import { loggerFor } from '../logger';
import fetch from 'node-fetch';
import { SchemasDictionary } from './schema-entities';
import promiseTools from 'promise-tools';
const L = loggerFor(__filename);

export interface SchemaServiceRestClient {
  fetchSchema(schemaSvcUrl: string, name: string, version: string): Promise<SchemasDictionary>;
}

export const schemaClient: SchemaServiceRestClient = {
  fetchSchema: async (
    schemaSvcUrl: string,
    name: string,
    version: string,
  ): Promise<SchemasDictionary> => {
    // for testing where we need to work against stub schema
    if (schemaSvcUrl.startsWith('file://')) {
      L.debug(`in fetch schema ${version}`);
      const result = delay(1000);
      const dictionary = await result(() => {
        const dictionaryJson = require(schemaSvcUrl.substring(7, schemaSvcUrl.length));
        return dictionaryJson;
      });
      L.debug(`schema found ${dictionary.version}`);
      return dictionary;
    }

    if (!schemaSvcUrl) {
      throw new Error('please configure a valid url to get schema from');
    }
    const url = `${schemaSvcUrl}/dictionaries?name=${name}&version=${version}`;
    try {
      const retryAttempt = 1;
      const schemasDictionaryRes = await promiseTools.retry(
        { times: 5, interval: 1000 },
        async () => {
          L.debug(`fetching schema attempt #${retryAttempt}`);
          return promiseTools.timeout(fetch(url), 5000);
        },
      );
      const schemaDictionary = await schemasDictionaryRes.json();

      // todo validate response and map it to a schema
      return schemaDictionary[0] as SchemasDictionary;
    } catch (err) {
      L.error(`failed to fetch schema using this url: ${url}`, err);
      throw new Error('failed to get the schema');
    }
  },
};

function delay(milliseconds: number) {
  return async (result: () => SchemasDictionary) => {
    return new Promise<SchemasDictionary>((resolve, reject) => {
      setTimeout(() => resolve(result()), milliseconds);
    });
  };
}
