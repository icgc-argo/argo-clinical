import fs from "fs";
import { Request, Response } from "express";
import deepFreeze from "deep-freeze";
const fsPromises = fs.promises;

export namespace TsvUtils {
  export const tsvToJson = async (
    file: Express.Multer.File
  ): Promise<ReadonlyArray<{ [key: string]: string }>> => {
    const contents = await fsPromises.readFile(file.path, "utf-8");
    const arr = parseTsvToJson(contents);
    return arr;
  };

  export const parseTsvToJson = (content: string): ReadonlyArray<{ [key: string]: string }> => {
    const lines = content.split("\n");
    const headers = lines.slice(0, 1)[0].split("\t");
    const rows = lines.slice(1, lines.length).map(line => {
      // check for any empty lines
      if (line.trim() === "") {
        return undefined;
      }
      const data = line.split("\t");
      return headers.reduce<{ [k: string]: string }>((obj, nextKey, index) => {
        obj[nextKey] = data[index];
        return obj;
      }, {});
    });
    return rows.filter(notEmpty);
  };
}

export namespace ControllerUtils {
  export const notFound = (res: Response, msg: string): any => {
    res.status(404).send({ message: msg });
  };

  export const badRequest = (res: Response, msg: string): any => {
    res.status(400).send({ message: msg });
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
}

// type gaurd to filter out undefined and null
// https://stackoverflow.com/questions/43118692/typescript-filter-out-nulls-from-an-array
export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

export function isString(value: any): value is string {
  return value instanceof String;
}

export const isNotEmptyString = (value: string) => {
  return isNotAbsent(value) && value.trim() !== "";
};

export const isEmptyString = (value: string) => {
  return !isNotEmptyString(value);
};

export const isAbsent = (value: string | number | boolean) => {
  return !isNotAbsent(value);
};

export const isNotAbsent = (value: string | number | boolean) => {
  return value !== null && value !== undefined;
};

export const F = deepFreeze;
