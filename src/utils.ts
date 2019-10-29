import fs from 'fs';
import { Response } from 'express';
import deepFreeze from 'deep-freeze';
import mongoose from 'mongoose';
import { FieldNamesByPriorityMap } from './lectern-client/schema-entities';
const fsPromises = fs.promises;

export namespace TsvUtils {
  export const tsvToJson = async (
    file: string,
    expectedHeaderFields?: FieldNamesByPriorityMap,
  ): Promise<ReadonlyArray<{ [key: string]: string }>> => {
    const contents = await fsPromises.readFile(file, 'utf-8');
    if (expectedHeaderFields) {
      const fileHeaderFields: string[] = contents
        .split(/\n/)[0]
        .split(/\t/)
        .filter(fieldName => fieldName !== '');
      checkHeaders(fileHeaderFields, expectedHeaderFields);
    }
    const arr = parseTsvToJson(contents);
    return arr;
  };

  const checkHeaders = (
    fileHeaderFields: string[],
    expectedHeaderFields: FieldNamesByPriorityMap,
  ) => {
    const fileHeaderFieldsSet = new Set<string>(fileHeaderFields);
    const missingFields: string[] = [];

    expectedHeaderFields.required.forEach(requriedField => {
      if (!fileHeaderFieldsSet.has(requriedField)) {
        missingFields.push(requriedField);
      } else {
        fileHeaderFieldsSet.delete(requriedField);
      }
    });
    expectedHeaderFields.optional.forEach(optionalField =>
      fileHeaderFieldsSet.delete(optionalField),
    );

    const unknownFields = Array.from(fileHeaderFieldsSet); // remaining are unknown

    if (missingFields.length === 0 && unknownFields.length === 0) {
      return;
    }
    throw new TsvHeaderError(missingFields, unknownFields);
  };

  export const parseTsvToJson = (content: string): ReadonlyArray<{ [key: string]: string }> => {
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
      return headers.reduce<{ [k: string]: string }>((obj, nextKey, index) => {
        obj[nextKey] = (data[index] && data[index].trim()) || '';
        return obj;
      }, {});
    });
    return rows.filter(notEmpty);
  };

  export class TsvHeaderError extends Error {
    missingFields: string[];
    unknownFields: string[];
    constructor(missingFields: string[], unknownFields: string[]) {
      super();
      this.missingFields = missingFields;
      this.unknownFields = unknownFields;
    }
  }
}

export namespace ControllerUtils {
  export interface ControllerBadRequestError {
    msg: string;
    code: string;
  }

  export const notFound = (res: Response, msg: string): any => {
    res.status(404).send({ message: msg });
  };

  export const badRequest = (
    res: Response,
    msg: string | ControllerBadRequestError | Array<ControllerBadRequestError>,
  ): any => {
    if (typeof msg === 'string') {
      return res.status(400).send({ message: msg });
    }
    res.status(400).send(msg);
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
  return value !== null && value !== undefined;
}

export function isString(value: any): value is string {
  return value instanceof String;
}

export const isStringMatchRegex = (expression: string, value: string) => {
  return RegExp(expression).test(value);
};

export const isNotEmptyString = (value: string) => {
  return isNotAbsent(value) && value.trim() !== '';
};

export const isEmptyString = (value: string) => {
  return !isNotEmptyString(value);
};

export const isAbsent = (value: string | number | boolean | undefined) => {
  return !isNotAbsent(value);
};

export const isNotAbsent = (value: string | number | boolean | undefined) => {
  return value !== null && value !== undefined;
};

export const F = deepFreeze;
