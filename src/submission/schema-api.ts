import * as manager from '../lectern-client/schema-manager';
import { Request, Response } from 'express';
import { loggerFor } from '../logger';
import { SchemasDictionary, SchemaDefinition } from '../lectern-client/schema-entities';
import { setStatus, Status } from '../app-health';
import { ControllerUtils } from '../utils';
import { FileType } from './submission-api';
import AdmZip from 'adm-zip';
import { HasFullWriteAccess } from '../auth-decorators';

const L = loggerFor(__filename);

class SchemaController {
  @HasFullWriteAccess()
  async update(req: Request, res: Response) {
    const version: string = req.body.version;
    await manager.instance().updateVersion(manager.instance().getCurrent().name, version);
    setStatus('schema', { status: Status.OK });
    return res.status(200).send(manager.instance().getCurrent());
  }
}

export const schemaController = new SchemaController();

export const get = async (req: Request, res: Response) => {
  const schema = manager.instance().getCurrent();
  if (!schema) {
    setStatus('schema', { status: Status.ERROR });
    return res.status(404).send('no schema found');
  }
  return res.status(200).send(schema);
};

export const getAllSchemas = async (req: Request, res: Response) => {
  return res.status(200).send(
    manager
      .instance()
      .getSubSchemasList()
      .filter(s => s !== FileType.REGISTRATION),
  );
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
  const template = createTemplate(schema);
  return res
    .status(200)
    .contentType('text/tab-separated-values')
    .attachment(`${schemaName}.tsv`)
    .send(template);
};

export const getAllTemplates = async (req: Request, res: Response) => {
  const schemasDictionary = manager.instance().getCurrent();
  const zip = new AdmZip();
  res
    .status(200)
    .contentType('application/zip')
    .attachment('argo_submission_templates.zip');

  schemasDictionary.schemas
    .filter(s => s.name !== FileType.REGISTRATION)
    .forEach(schema => {
      const template = createTemplate(schema);
      zip.addFile(`${schema.name}.tsv`, Buffer.alloc(template.length, template));
    });

  return res.send(zip.toBuffer());
};

function createTemplate(schema: SchemaDefinition): string {
  const header =
    schema.fields
      .map((f): string => {
        return f.name;
      })
      .join('\t') + '\n';
  return header;
}
