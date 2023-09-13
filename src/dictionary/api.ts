/*
 * Copyright (c) 2023 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import * as manager from './manager';
import { Request, Response } from 'express';
import { loggerFor } from '../logger';
import { entities as dictionaryEntities } from '@overturebio-stack/lectern-client';
import { setStatus, Status } from '../app-health';
import { ControllerUtils } from '../utils';
import { ClinicalEntitySchemaNames } from '../common-model/entities';
import AdmZip from 'adm-zip';
import { HasFullWriteAccess } from '../decorators';
const L = loggerFor(__filename);

class SchemaController {
  @HasFullWriteAccess()
  async update(req: Request, res: Response) {
    const version: string = req.body.version;
    const sync: boolean = req.query.sync;
    const initiator = ControllerUtils.getUserFromToken(req);
    const migration = await manager.instance().updateSchemaVersion(version, initiator, sync);
    return res.status(200).send(migration);
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
  const schema = await manager.instance().getCurrent();
  if (!schema) {
    setStatus('schema', { status: Status.ERROR });
    return res.status(404).send('no schema found');
  }
  return res.status(200).send(schema);
};

export const getClinicalEntities = async (req: Request, res: Response) => {
  const includeFields = req.query.includeFields as string;
  if (includeFields && includeFields.toLowerCase() === 'true') {
    const schemasWithFields = await manager.instance().getSchemasWithFields();
    return res
      .status(200)
      .send(schemasWithFields.filter(s => s.name !== ClinicalEntitySchemaNames.REGISTRATION));
  }
  const schemas = await manager.instance().getSchemaNames();
  return res.status(200).send(schemas.filter(s => s !== ClinicalEntitySchemaNames.REGISTRATION));
};

export const getClinicalEntitiesData = async (includeFields: string) => {
  const schemasWithFields = await manager.instance().getSchemasWithFields();
  return schemasWithFields.filter(s => s.name !== ClinicalEntitySchemaNames.REGISTRATION);
};

export const getTemplate = async (req: Request, res: Response) => {
  const schemaName: string = req.params.schemaName;
  const schemasDictionary = await manager.instance().getCurrent();
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
  // by default it should not exclude sample registration file.
  const excludeSampleRegistration: boolean = req.query.excludeSampleRegistration
    ? req.query.excludeSampleRegistration == 'true'
    : false;
  const schemasDictionary = await manager.instance().getCurrent();
  const zip = new AdmZip();
  res
    .status(200)
    .contentType('application/zip')
    .attachment(`argo_submission_templates_v${schemasDictionary.version}.zip`);

  schemasDictionary.schemas
    .filter(s =>
      excludeSampleRegistration ? s.name !== ClinicalEntitySchemaNames.REGISTRATION : true,
    )
    .forEach(schema => {
      const template = createTemplate(schema);
      zip.addFile(
        `${schema.name}_v${schemasDictionary.version}.tsv`,
        Buffer.alloc(template.length, template),
      );
    });

  return res.send(zip.toBuffer());
};

function createTemplate(schema: dictionaryEntities.SchemaDefinition): string {
  const header =
    schema.fields
      .map((f): string => {
        return f.name;
      })
      .join('\t') + '\n';
  return header;
}
