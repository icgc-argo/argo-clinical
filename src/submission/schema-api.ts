import * as manager from "../lectern-client/schema-manager";
import { Request, Response } from "express";
import { loggerFor } from "../logger";
import { SchemasDictionary, SchemaDefinition } from "../lectern-client/schema-entities";
import { setStatus, Status } from "../app-health";
import { ControllerUtils } from "../utils";
const L = loggerFor(__filename);

export const get = async (req: Request, res: Response) => {
  const schema = manager.instance().getCurrent();
  if (!schema) {
    setStatus("schema", { status: Status.ERROR });
    return res.status(404).send("no schema found");
  }
  return res.status(200).send(schema);
};

export const update = async (req: Request, res: Response) => {
  // currently we only use 1 version
  await manager
    .instance()
    .updateVersion(manager.instance().getCurrent().name, manager.instance().getCurrent().version);
  setStatus("schema", { status: Status.OK });
  return res.status(200).send(manager.instance().getCurrent());
};

export const replace = async (req: Request, res: Response) => {
  // currently we only use 1 version
  await manager.instance().replace(req.body as SchemasDictionary);
  setStatus("schema", { status: Status.OK });
  return res.status(200).send(manager.instance().getCurrent());
};

export const getTemplate = async (req: Request, res: Response) => {
  const schemaName: string = req.params.schemaName;
  const schemasDictionary = manager.instance().getCurrent();
  const schema = schemasDictionary.schemas.find(schema => {
    return schema.name == schemaName;
  });
  if (!schema) {
    return ControllerUtils.notFound(res, "no schema named '" + schemaName + "' found");
  }
  const template = createTemplate(schema);
  return res
    .status(200)
    .contentType("text/tab-separated-values")
    .send(template);
};

function createTemplate(schema: SchemaDefinition): string {
  const header =
    schema.fields
      .map((f): string => {
        return f.name;
      })
      .join("\t") + "\n";
  return header;
}
