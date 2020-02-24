import * as manager from './schema-manager';
import { Request, Response } from 'express';
import { loggerFor } from '../../logger';
import { SchemasDictionary, SchemaDefinition } from '../../lectern-client/schema-entities';
import { setStatus, Status } from '../../app-health';
import { ControllerUtils } from '../../utils';
import { ClinicalEntitySchemaNames } from '../submission-entities';
import AdmZip from 'adm-zip';
import { HasFullWriteAccess } from '../../decorators';
const L = loggerFor(__filename);

class SchemaController {
  @HasFullWriteAccess()
  async update(req: Request, res: Response) {
    const version: string = req.body.version;
    const sync: boolean = req.query.sync;
    const initiator = ControllerUtils.getUserFromToken(req);
    await manager.instance().updateSchemaVersion(version, initiator, sync);
    setStatus('schema', { status: Status.OK });
    return res.status(200).send(manager.instance().getCurrent());
  }

  @HasFullWriteAccess()
  async probe(req: Request, res: Response) {
    const from = req.query.from;
    const to = req.query.to;
    const result = await manager.instance().probeSchemaUpgrade(from, to);
    return res.status(200).send(result);
  }

  @HasFullWriteAccess()
  async dryRunUpdate(req: Request, res: Response) {
    const version: string = req.body.version;
    const initiator = ControllerUtils.getUserFromToken(req);
    const migration = await manager.instance().dryRunSchemaUpgrade(version, initiator);
    return res.status(200).send(migration);
  }

  @HasFullWriteAccess()
  async getMigration(req: Request, res: Response) {
    const id: string | undefined = req.params.id;
    const migration = await manager.instance().getMigration(id);
    return res.status(200).send(migration);
  }

  @HasFullWriteAccess()
  async resumeMigration(req: Request, res: Response) {
    const sync: boolean = req.query.sync || false;
    const migration = await manager.instance().resumeMigration(sync);
    return res.status(200).send(migration);
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

export const getClinicalEntities = async (req: Request, res: Response) => {
  const includeFields = req.query.includeFields as string;
  if (includeFields && includeFields.toLowerCase() === 'true') {
    return res.status(200).send(
      manager
        .instance()
        .getSchemasWithFields()
        .filter(s => s.name !== ClinicalEntitySchemaNames.REGISTRATION),
    );
  }

  return res.status(200).send(
    manager
      .instance()
      .getSchemas()
      .filter(s => s !== ClinicalEntitySchemaNames.REGISTRATION),
  );
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
    .attachment(`${schemaName}_dictionary_v${schemasDictionary.version}.tsv`)
    .send(template);
};

export const getAllTemplates = async (req: Request, res: Response) => {
  const schemasDictionary = manager.instance().getCurrent();
  const zip = new AdmZip();
  res
    .status(200)
    .contentType('application/zip')
    .attachment(`argo_submission_templates_v${schemasDictionary.version}.zip`);

  schemasDictionary.schemas
    .filter(s => s.name !== ClinicalEntitySchemaNames.REGISTRATION)
    .forEach(schema => {
      const template = createTemplate(schema);
      zip.addFile(
        `${schema.name}_v${schemasDictionary.version}.tsv`,
        Buffer.alloc(template.length, template),
      );
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
