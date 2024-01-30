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

import { NextFunction, Request, Response } from 'express';
import { HasFullReadAccess, HasFullWriteAccess } from '../decorators';
import { loggerFor } from '../logger';
import { ControllerUtils, TsvUtils } from '../utils';
import { ExceptionTSVError } from './error-handling';
import * as exceptionService from './exception-service';
import programExceptionRepository from './repo/program';
import {
  EntityExceptionRecord,
  isEntityExceptionRecord,
  isProgramExceptionRecord,
  isReadonlyArrayOf,
  ProgramExceptionRecord,
  isSpecimenExceptionRecord,
  isFollowupExceptionRecord,
  isTreatmentExceptionRecord,
} from './types';
import { ClinicalEntitySchemaNames } from '../common-model/entities';

const L = loggerFor(__filename);

type ValidateRecords<T> = (records: ReadonlyArray<TsvUtils.TsvRecordAsJsonObj>) => ReadonlyArray<T>;

const validateProgramExceptionRecords: ValidateRecords<ProgramExceptionRecord> = records => {
  if (!isReadonlyArrayOf(records, isProgramExceptionRecord)) {
    L.debug(`Program Exception TSV_PARSING_FAILED`);
    throw new ExceptionTSVError('Invalid program exception tsv file');
  }
  return records;
};

type ValidateEntityRecords<T> = (
  records: ReadonlyArray<TsvUtils.TsvRecordAsJsonObj>,
) => { records: ReadonlyArray<T>; schema: ClinicalEntitySchemaNames };

const validateEntityExceptionRecords: ValidateEntityRecords<EntityExceptionRecord> = records => {
  // check base entity exception record
  if (!isReadonlyArrayOf(records, isEntityExceptionRecord)) {
    L.debug(`Entity Exception TSV_PARSING_FAILED`);
    throw new ExceptionTSVError('Invalid entity exception tsv file');
  }

  // at this point we know it's an entity exception record
  // get specific type of entity
  if (isReadonlyArrayOf(records, isSpecimenExceptionRecord)) {
    return { records, schema: ClinicalEntitySchemaNames.SPECIMEN };
  } else if (isReadonlyArrayOf(records, isFollowupExceptionRecord)) {
    return { records, schema: ClinicalEntitySchemaNames.FOLLOW_UP };
  } else if (isReadonlyArrayOf(records, isTreatmentExceptionRecord)) {
    return { records, schema: ClinicalEntitySchemaNames.TREATMENT };
  } else {
    throw new ExceptionTSVError(
      'Invalid file. Please check columns. Only Specimen, Follow Up, or Treatment are accepted.',
    );
  }
};

class ExceptionController {
  @HasFullWriteAccess()

  // program exceptions
  async createProgramException(req: Request, res: Response) {
    const programId = req.params.programId;
    const records = await parseTSV(req.file.path);
    const programExceptionRecords = validateProgramExceptionRecords(records);

    const result = await exceptionService.operations.createProgramException({
      programId,
      records: programExceptionRecords,
    });

    const status = result.success ? 201 : 422;
    return res.status(status).send(result);
  }

  @HasFullWriteAccess()
  async clearProgramException(req: Request, res: Response) {
    const programId = req.params.programId;
    const result = await exceptionService.operations.deleteProgramException({ programId });
    return res.status(result.success ? 200 : 400).send(result);
  }

  @HasFullReadAccess()
  async getProgramException(req: Request, res: Response) {
    const programId = req.params.programId;
    const result = await exceptionService.operations.getProgramException({ programId });
    return res.status(result.success ? 200 : 400).send(result);
  }

  // entity exceptions
  @HasFullWriteAccess()
  async createEntityException(req: Request, res: Response) {
    const programId = req.params.programId;
    const programException = await programExceptionRepository.find(programId);

    if (programException?.exceptions?.length) {
      L.debug('program exception exists already');
      return res.status(400).send('Program exception already exists');
    }

    const records = await parseTSV(req.file.path);
    // validate tsv structure using cols, does not validate field data
    const { records: entityExceptionRecords, schema } = validateEntityExceptionRecords(records);

    const result = await exceptionService.operations.createEntityException({
      programId,
      records: entityExceptionRecords,
      schema,
    });

    return res.status(200).send(result);
  }

  @HasFullReadAccess()
  async getEntityException(req: Request, res: Response) {
    const programId = req.params.programId;
    const result = await exceptionService.operations.getEntityException({ programId });
    return res.status(result.success ? 200 : 400).send(result);
  }

  @HasFullWriteAccess()
  async deleteEntityException(req: Request, res: Response) {
    const { programId, entity } = req.params;
    const { submitterDonorIds } = req.body;

    const result = await exceptionService.operations.deleteEntityException({
      programId,
      entity,
      submitterDonorIds,
    });

    return res.status(result.success ? 200 : 400).send(result);
  }
}

const parseTSV = async (filepath: string) => {
  L.debug('parse tsv');
  const records = await TsvUtils.tsvToJson(filepath);
  if (records.length === 0) {
    throw new ExceptionTSVError();
  }
  return records;
};

export const requestContainsFile = (req: Request, res: Response, next: NextFunction) => {
  L.debug('requestContainsFile');
  if (req.file === undefined || req.file.size <= 0) {
    L.debug(`File missing`);
    return ControllerUtils.badRequest(res, `Exception file upload required`);
  }
  next();
};

export default new ExceptionController();
