import * as manager from "./schema-manager";
import { Request, Response } from "express";
import { loggerFor } from "../logger";
import { SchemasDictionary } from "./schema-entities";
const L = loggerFor(__filename);

export const get = async (req: Request, res: Response) => {
  const schema = manager.getCurrent();
  if (!schema) {
    return res.status(404).send("no schema found");
  }
  return res.status(200).send(schema);
};

export const update = async (req: Request, res: Response) => {
  // currently we only use 1 version
  await manager.updateVersion(manager.getCurrent().name, manager.getCurrent().version);
  return res.status(200).send(manager.getCurrent());
};

export const replace = async (req: Request, res: Response) => {
  // currently we only use 1 version
  await manager.replace(req.body as SchemasDictionary);
  return res.status(200).send(manager.getCurrent());
};
