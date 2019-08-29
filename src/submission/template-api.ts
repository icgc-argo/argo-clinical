import * as manager from "../lectern-client/schema-manager";
import { Request, Response } from "express";
import { loggerFor } from "../logger";
import { SchemaDefinition, ValueType } from "../lectern-client/schema-entities";
import { setStatus, Status } from "../app-health";

const L = loggerFor(__filename);

export const get = async (req: Request, res: Response) => {
  const schemaName: string = req.params.schemaName;
  const schemasDictionary = manager.instance().getCurrent();
  if (!schemasDictionary) {
    setStatus("schema", { status: Status.ERROR });
    return res.status(404).send("no schema dictionary found");
  }
  const schema = schemasDictionary.schemas.find((schema) => {
    return schema.name == schemaName;
  });
  if (!schema) {
    setStatus("schema", { status: Status.ERROR });
    return res.status(404).send("no schema named " + schemaName + " found");
  }
  const template = createTemplate(schema);
  return res.status(200).send(template);
};

function createTemplate(schema: SchemaDefinition): string {
  const header = schema.fields.map((f): string => {
    return f.name;
  }).join("\t") + "\n";
  const body = schema.fields.map((f): string => {
    return defaultStringForType(f.valueType);
  }).join("\t") + "\n";
  return header + body;
}

function defaultStringForType(v: ValueType): string {
  switch (v) {
    case ValueType.BOOLEAN:
      return "false";
    case ValueType.INTEGER:
      return "0";
    case ValueType.NUMBER:
      return "0.0";
    case ValueType.STRING:
      return "\"\"";
    default: return "???";
  }
}