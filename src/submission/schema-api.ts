import * as manager from "../lectern-client/schema-manager";
import { Request, Response } from "express";
import { loggerFor } from "../logger";
import { SchemasDictionary } from "../lectern-client/schema-entities";
import { setStatus } from "../app-health";
const L = loggerFor(__filename);

export const get = async (req: Request, res: Response) => {
  const schema = manager.instance().getCurrent();
  if (!schema) {
    setStatus("schema", { status: "RED" });
    return res.status(404).send("no schema found");
  }
  return res.status(200).send(schema);
};

export const update = async (req: Request, res: Response) => {
  // currently we only use 1 version
  await manager
    .instance()
    .updateVersion(manager.instance().getCurrent().name, manager.instance().getCurrent().version);
  setStatus("schema", { status: "GREEN" });
  return res.status(200).send(manager.instance().getCurrent());
};

export const replace = async (req: Request, res: Response) => {
  // currently we only use 1 version
  await manager.instance().replace(req.body as SchemasDictionary);
  setStatus("schema", { status: "GREEN" });
  return res.status(200).send(manager.instance().getCurrent());
};
