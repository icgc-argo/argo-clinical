import fs from 'fs';
import { Response, Request } from 'express';
import deepFreeze from 'deep-freeze';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { SubmissionBatchError } from './submission/submission-entities';
import _ from 'lodash';
import { isArray } from 'util';

const fsPromises = fs.promises;

export namespace TsvUtils {
  export type TsvRecordAsJsonObj = { [header: string]: string | string[] };

  export const tsvToJson = async (file: string): Promise<ReadonlyArray<TsvRecordAsJsonObj>> => {
    const contents = await fsPromises.readFile(file, 'utf-8');
    const arr = parseTsvToJson(contents);
    return arr;
  };

  export const parseTsvToJson = (content: string): ReadonlyArray<TsvRecordAsJsonObj> => {
    const lines = content.split('\n');
    const headers = lines
      .slice(0, 1)[0]
      .trim()
      .split('\t');
    const rows = lines.slice(1, lines.length).map(line => {
      // check for any empty lines
      if (!line || line.trim() === '') {
        return undefined;
      }
      const data = line.split('\t');
      return headers.reduce<TsvRecordAsJsonObj>((obj, nextKey, index) => {
        const arrData = (data[index] || '')
          .trim()
          .split(',')
          .map(s => s.trim());

        obj[nextKey] = arrData.length === 1 ? arrData[0] : arrData;
        return obj;
      }, {});
    });
    return rows.filter(notEmpty);
  };

  export const convertJsonRecordsToTsv = (jsonRecords: any, headers: string[]) => {
    const columns: number = headers.length;
    // map headers to an index, used to place recordObject values in correct column
    const headersToColumnMap: Record<string, number> = {};
    headers.map((f, i) => (headersToColumnMap[f] = i));

    const allTsvRecords = new Array<string>(jsonRecords.length);
    jsonRecords.forEach((jr: any, i: number) => {
      const tsvRecordAsArray = new Array<string>(columns);
      Object.entries(jr).forEach(([key, val]) => {
        const indexInTsvArray = headersToColumnMap[key];
        if (isNaN(indexInTsvArray)) {
          return undefined; // couldn't match field with expected headers so ignore it
        }
        if (Array.isArray(val)) {
          tsvRecordAsArray[indexInTsvArray] = val.map(convertToTrimmedString).join(', ');
        } else {
          tsvRecordAsArray[indexInTsvArray] = convertToTrimmedString(val);
        }
      });
      allTsvRecords[i] = tsvRecordAsArray.join('\t'); // hold order of recordsObjects
    });

    const headersStr = headers.join('\t');
    return headersStr + '\n' + allTsvRecords.join('\n');
  };
}

export namespace ControllerUtils {
  export const notFound = (res: Response, msg: string): any => {
    res.status(404).send({ message: msg });
  };

  export const badRequest = (res: Response, message: string): any => {
    return res.status(400).send({ message });
  };

  export const serviceUnavailable = (res: Response, message: string): any => {
    return res.status(503).send({ message });
  };

  export const invalidBatch = (
    res: Response,
    batchErrors: SubmissionBatchError | SubmissionBatchError[],
  ): any => {
    if (Array.isArray(batchErrors)) {
      return res.status(422).send({ batchErrors });
    }
    return res.status(422).send({ batchErrors: [batchErrors] });
  };

  // checks authHeader + decoded jwt and returns the user name
  export const getUserFromToken = (req: Request): string => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new Error("can't get here without auth header");
    }
    const decoded = jwt.decode(authHeader.split(' ')[1]) as any;
    if (!decoded || !decoded.context || !decoded.context.user) {
      throw new Error('invalid token structure');
    }
    return decoded.context.user.firstName + ' ' + decoded.context.user.lastName;
  };
}

export namespace Checks {
  export const checkNotNull = (argName: string, arg: any) => {
    if (!arg) {
      throw new Errors.InvalidArgument(argName);
    }
  };
}
export namespace Errors {
  export class InvalidArgument extends Error {
    constructor(argumentName: string) {
      super(`Invalid argument : ${argumentName}`);
    }
  }

  export class NotFound extends Error {
    constructor(msg: string) {
      super(msg);
    }
  }

  export class StateConflict extends Error {
    constructor(msg: string) {
      super(msg);
    }
  }
}

export namespace MongooseUtils {
  export const toPojo = (doc: mongoose.Document) => {
    const pojo = doc.toObject();
    if (pojo._id) {
      pojo._id = pojo._id.toString();
    }
    return pojo;
  };
}

// type gaurd to filter out undefined and null
// https://stackoverflow.com/questions/43118692/typescript-filter-out-nulls-from-an-array
export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined && !_.isEmpty(value);
}

export function isEmpty<TValue>(value: TValue | null | undefined): value is undefined {
  return !notEmpty(value);
}

export const convertToArray = <T>(val: T | T[]): T[] => {
  if (Array.isArray(val)) {
    return val;
  } else {
    return [val];
  }
};

export function isString(value: any): value is string {
  return typeof value === 'string' || value instanceof String;
}

export function isStringArray(value: any | undefined | null): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

export function isNumber(value: any): value is number {
  return typeof value === 'number';
}

export function isNumberArray(values: any): values is number[] {
  return Array.isArray(values) && values.every(isNumber);
}

// returns true if value matches at least one of the expressions
export const isStringMatchRegex = (expressions: RegExp[], value: string) => {
  return expressions.filter(exp => RegExp(exp).test(value)).length >= 1;
};

export const isNotEmptyString = (value: string | undefined): value is string => {
  return isNotAbsent(value) && value.trim() !== '';
};

export const isEmptyString = (value: string) => {
  return !isNotEmptyString(value);
};

export const isAbsent = (value: string | number | boolean | undefined): value is undefined => {
  return !isNotAbsent(value);
};

export const isNotAbsent = (
  value: string | number | boolean | undefined,
): value is string | number | boolean => {
  return value !== null && value !== undefined;
};

export const sleep = async (milliSeconds: number = 2000) => {
  return new Promise(resolve => setTimeout(resolve, milliSeconds));
};

export function mergeAndDeleteRemoved(obj: { [k: string]: any }, override: { [k: string]: any }) {
  const keys = new Set(Object.keys(override));
  _.merge(obj, override);
  for (const key in obj) {
    const exists = keys.has(key);
    if (!exists) {
      delete obj[key];
    }
  }
  return;
}

export function toString(obj: any) {
  if (!obj) {
    return undefined;
  }
  Object.keys(obj).forEach(k => {
    if (typeof obj[k] === 'object') {
      return toString(obj[k]);
    }
    obj[k] = `${obj[k]}`;
  });

  return obj;
}

export function deepFind(obj: any, path: string) {
  const paths = path.split('.');
  let current = obj;
  let result: any[] = [];

  for (let i = 0; i < paths.length; ++i) {
    if (_.isArray(current)) {
      const r = current
        .map(e => {
          return deepFind(e, paths.slice(i).join('.'));
        })
        .filter(notEmpty);
      result = result.concat(...r);
      return result;
    }

    if (current[paths[i]] == undefined) {
      return [];
    } else {
      current = current[paths[i]];
    }
  }

  current && result.push(current);
  return result;
}

export function isValueEqual(value: any, other: any) {
  if (isArray(value) && isArray(other)) {
    return _.difference(value, other).length === 0; // check equal, ignore order
  }

  return _.isEqual(value, other);
}

export function isValueNotEqual(value: any, other: any) {
  return !isValueEqual(value, other);
}

export function convertToTrimmedString(
  val: unknown | undefined | string | number | boolean | null,
) {
  return val === undefined || val === null ? '' : String(val).trim();
}

export const F = deepFreeze;
