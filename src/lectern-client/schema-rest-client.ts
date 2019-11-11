import { loggerFor } from '../logger';
import fetch from 'node-fetch';
import {
  SchemasDictionary,
  SchemasDictionaryDiffs,
  FieldChanges,
  FieldDiff,
} from './schema-entities';
import promiseTools from 'promise-tools';
const L = loggerFor(__filename);

export interface SchemaServiceRestClient {
  fetchSchema(schemaSvcUrl: string, name: string, version: string): Promise<SchemasDictionary>;
  fetchDiff(
    schemaSvcUrl: string,
    name: string,
    fromVersion: string,
    toVersion: string,
  ): Promise<SchemasDictionaryDiffs>;
}

export const schemaClient: SchemaServiceRestClient = {
  fetchSchema: async (
    schemaSvcUrl: string,
    name: string,
    version: string,
  ): Promise<SchemasDictionary> => {
    // for testing where we need to work against stub schema
    if (schemaSvcUrl.startsWith('file://')) {
      return await loadSchemaFromFile(version, schemaSvcUrl, name);
    }

    if (!schemaSvcUrl) {
      throw new Error('please configure a valid url to get schema from');
    }
    const url = `${schemaSvcUrl}/dictionaries?name=${name}&version=${version}`;
    try {
      L.debug(`in fetch live schema ${version}`);
      const schemaDictionary = await doRequest(url);
      // todo validate response and map it to a schema
      return schemaDictionary[0] as SchemasDictionary;
    } catch (err) {
      L.error(`failed to fetch schema using this url: ${url}`, err);
      throw new Error('failed to get the schema');
    }
  },
  fetchDiff: async (
    schemaSvcBaseUrl: string,
    name: string,
    fromVersion: string,
    toVersion: string,
  ): Promise<SchemasDictionaryDiffs> => {
    const url = `${schemaSvcBaseUrl}/diff?name=${name}&left=${fromVersion}&right=${toVersion}`;
    const diffResponse = (await doRequest(url)) as any[];
    const result: SchemasDictionaryDiffs = {};
    for (const entry of diffResponse) {
      const fieldName = entry[0] as string;
      if (entry[1]) {
        const fieldDiff: FieldDiff = {
          before: entry[1].left,
          after: entry[1].right,
          diff: entry[1].diff,
        };
        result[fieldName] = fieldDiff;
      }
    }
    return result;
  },
};

const doRequest = async (url: string) => {
  try {
    const retryAttempt = 1;
    const response = await promiseTools.retry({ times: 5, interval: 1000 }, async () => {
      L.debug(`fetching schema attempt #${retryAttempt}`);
      return promiseTools.timeout(fetch(url), 5000);
    });
    return await response.json();
  } catch (err) {
    L.error(`failed to fetch schema using this url: ${url}`, err);
    throw new Error('failed to get the schema');
  }
};

async function loadSchemaFromFile(version: string, schemaSvcUrl: string, name: string) {
  L.debug(`in fetch stub schema ${version}`);
  const result = delay<SchemasDictionary>(1000);
  const dictionary = await result(() => {
    const dictionaries: SchemasDictionary[] = require(schemaSvcUrl.substring(
      7,
      schemaSvcUrl.length,
    )).dictionaries as SchemasDictionary[];
    if (!dictionaries) {
      throw new Error(
        'your mock json is not structured correctly, see sampleFiles/sample-schema.json',
      );
    }
    const dic = dictionaries.find((d: any) => d.version == version && d.name == name);
    if (!dic) {
      return undefined;
    }
    return dic;
  });
  if (dictionary == undefined) {
    throw new Error("couldn't load stub dictionary with the criteria specified");
  }
  L.debug(`schema found ${dictionary.version}`);
  return dictionary;
}

async function loadDiffFromFile(
  schemaSvcBaseUrl: string,
  name: string,
  fromVersion: string,
  toVersion: string,
) {
  L.debug(`in fetch stub diffs ${name} ${fromVersion} ${toVersion}`);
  const result = delay<any>(1000);
  const diff = await result(() => {
    const diffResponse = require(schemaSvcBaseUrl.substring(7, schemaSvcBaseUrl.length))
      .diffs as any[];
    if (!diffResponse) {
      throw new Error(
        'your mock json is not structured correctly, see sampleFiles/sample-schema.json',
      );
    }

    const diff = diffResponse.find(
      (d: any) => d.fromVersion == fromVersion && d.toVersion == toVersion && d.name == name,
    );
    if (!diff) {
      return undefined;
    }
    return diff;
  });
  if (diff == undefined) {
    throw new Error("couldn't load stub diff with the criteria specified, check your stub file");
  }
  return diff.data;
}

function delay<T>(milliseconds: number) {
  return async (result: () => T | undefined) => {
    return new Promise<T>((resolve, reject) => {
      setTimeout(() => resolve(result()), milliseconds);
    });
  };
}
