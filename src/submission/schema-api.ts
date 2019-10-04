import * as manager from '../lectern-client/schema-manager';
import { Request, Response } from 'express';
import { loggerFor } from '../logger';
import { SchemasDictionary, SchemaDefinition } from '../lectern-client/schema-entities';
import { setStatus, Status } from '../app-health';
import { ControllerUtils } from '../utils';
import Archiver from 'archiver';
import { FileType } from './submission-api';
const L = loggerFor(__filename);

export const get = async (req: Request, res: Response) => {
  const schema = manager.instance().getCurrent();
  if (!schema) {
    setStatus('schema', { status: Status.ERROR });
    return res.status(404).send('no schema found');
  }
  return res.status(200).send(schema);
};

export const getAllSchema = async (req: Request, res: Response) => {
  return res.status(200).send(manager.instance().getSubSchemasList());
};

export const update = async (req: Request, res: Response) => {
  // currently we only use 1 version
  await manager
    .instance()
    .updateVersion(manager.instance().getCurrent().name, manager.instance().getCurrent().version);
  setStatus('schema', { status: Status.OK });
  return res.status(200).send(manager.instance().getCurrent());
};

export const replace = async (req: Request, res: Response) => {
  // currently we only use 1 version
  await manager.instance().replace(req.body as SchemasDictionary);
  setStatus('schema', { status: Status.OK });
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
  const template = await createTemplate(schema);
  return res
    .status(200)
    .contentType('text/tab-separated-values')
    .send(template);
};

export const getAllTemplates = async (req: Request, res: Response) => {
  const schemasDictionary = manager.instance().getCurrent();
  const zip = Archiver('zip');

  res
    .status(200)
    .contentType('application/zip')
    .attachment('templates.zip');

  zip.pipe(res); // pipes everything appended to zip into the attactment in res
  for (const schema of schemasDictionary.schemas) {
    const schemaName = schema.name;
    if (schemaName === FileType.REGISTRATION) {
      continue;
    }
    zip.append(await createTemplate(schema), { name: schemaName + '.tsv' });
  }
  zip.finalize();

  return res;
};

async function createTemplate(schema: SchemaDefinition): Promise<string> {
  const header =
    schema.fields
      .map((f): string => {
        return f.name;
      })
      .join('\t') + '\n';
  return header;
}
