import * as manager from "./schema-manager";
import { Request, Response } from "express";
import { loggerFor } from "../logger";
const L = loggerFor(__filename);

export const getSchema = async (req: Request, res: Response) => {
    const schema = manager.getCurrent();
    if (!schema) {
        return  res.status(404).send("no schema found");
    }
    return res.status(200).send(schema);
};
