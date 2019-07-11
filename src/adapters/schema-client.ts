import { loggerFor } from "../logger";
import { DataSchema } from "../domain/entities/submission";
const L = loggerFor(__filename);
const stuff = require("../resources/stubSchema.json");
export let schema: any = {};

export const fetchSchema = async (version: string): Promise<DataSchema> => {
    const result = delay(1000);
    return result({
      version: version,
      definitions: stuff
    });
};

function delay(milliseconds: number) {
    return (result: DataSchema) => {
      return new Promise<DataSchema>((resolve, reject) => {
        setTimeout(() => resolve(result), milliseconds);
      });
    };
  }
