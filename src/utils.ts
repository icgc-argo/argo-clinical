import fs from 'fs';
import { Response } from 'express';
import deepFreeze from 'deep-freeze';
import mongoose from 'mongoose';
import { FieldNamesByPriority } from './lectern-client/schema-entities';
const fsPromises = fs.promises;

export namespace TsvUtils {
  export const tsvToJson = async (
    file: string,
    expectedHeader?: FieldNamesByPriority,
  ): Promise<ReadonlyArray<{ [key: string]: string }>> => {
    const contents = await fsPromises.readFile(file, 'utf-8');
    checkHeaders(
      contents
        .split(/\r?\n/)[0] // take first row in tsv
        .split(/\t/) // split field names into array
        .filter(fieldName => fieldName !== ''),
      expectedHeader,
    );
    const arr = parseTsvToJson(contents);
    return arr;
  };

  const checkHeaders = (fileFieldNames: string[], expectedHeader?: FieldNamesByPriority) => {
    if (!expectedHeader) {
      return;
    }
    const fileFieldNamesSet = new Set<string>(fileFieldNames);
    const missingFields: string[] = [];
    expectedHeader.required.forEach(requriedField => {
      if (!fileFieldNamesSet.has(requriedField)) {
        missingFields.push(requriedField);
      } else {
        fileFieldNamesSet.delete(requriedField);
      }
    });

    expectedHeader.optional.forEach(optionalField => fileFieldNamesSet.delete(optionalField));
    const unknownFields = Array.from(fileFieldNamesSet); // remaing are unknown

    if (missingFields.length === 0 && unknownFields.length === 0) {
      return;
    }
    throw new TsvHeadersError(missingFields, unknownFields);
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

  export class TsvHeadersError extends Error {
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
