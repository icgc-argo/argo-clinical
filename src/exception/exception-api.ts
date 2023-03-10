/*
 * Copyright (c) 2022 The Ontario Institute for Cancer Research. All rights reserved
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
import { ControllerUtils, Errors, TsvUtils } from '../utils';
import { RepoError } from './repo/types';
import * as exceptionService from './exception-service';
import {
  isReadonlyArrayOf,
  isProgramExceptionRecord,
  isEntityExceptionRecord,
  ProgramExceptionRecord,
  EntityExceptionRecord,
  EntityValues,
} from './types';

const L = loggerFor(__filename);

function getResStatus(result: exceptionService.Result): number {
  if (result.success) {
    return 200;
  } else if (result.error?.code === RepoError.DOCUMENT_UNDEFINED) {
    return 400;
  } else {
    return 500;
  }
}

type ValidateRecords<T> = (records: ReadonlyArray<TsvUtils.TsvRecordAsJsonObj>) => ReadonlyArray<T>;

const validateProgramExceptionRecords: ValidateRecords<ProgramExceptionRecord> = records => {
  if (!isReadonlyArrayOf(records, isProgramExceptionRecord)) {
    L.debug(`Program Exception TSV_PARSING_FAILED`);
    throw new Errors.TSVParseError();
  }
  return records;
};

const validateEntityExceptionRecords: ValidateRecords<EntityExceptionRecord> = records => {
  if (!isReadonlyArrayOf(records, isEntityExceptionRecord)) {
    L.debug(`Entity Exception TSV_PARSING_FAILED`);
    throw new Errors.TSVParseError();
  }
  return records;
};

class ExceptionController {
  @HasFullWriteAccess()
  // program level exceptions
  async createProgramException(req: Request, res: Response) {
    const programId = req.params.programId;
    const records = await parseTSV(req.file.path);
    const programExceptionRecords = validateProgramExceptionRecords(records);

    const result = await exceptionService.operations.createProgramException({
      programId,
      records: programExceptionRecords,
    });

    const status = !result.success ? 422 : 201;
    return res.status(status).send(result);
  }

  @HasFullWriteAccess()
  async clearProgramException(req: Request, res: Response) {
    const programId = req.params.programId;
    const result = await exceptionService.operations.deleteProgramException({ programId });
    return res.status(getResStatus(result)).send(result);
  }

  @HasFullReadAccess()
  async getProgramException(req: Request, res: Response) {
    const programId = req.params.programId;
    const result = await exceptionService.operations.getProgramException({ programId });
    return res.status(getResStatus(result)).send(result);
  }

  @HasFullWriteAccess()
  async createEntityException(req: Request, res: Response) {
    const programId = req.params.programId;
    const existingProgramException = await exceptionService.operations.getProgramException({
      programId,
    });

    if (existingProgramException.exception !== undefined) {
      L.debug('program exception exists already');
      return res.status(400).send('program exception already exists');
    }

    const records = await parseTSV(req.file.path);
    const entityExceptionRecords = validateEntityExceptionRecords(records);

    const result = await exceptionService.operations.createEntityException({
      programId,
      records: entityExceptionRecords,
      entity: EntityValues.specimen,
    });

    const status = !result.success ? 422 : 201;
    return res.status(status).send(result);
  }

  @HasFullWriteAccess()
  async deleteEntityException(req: Request, res: Response) {
    const { programId } = req.params;
    const { entity } = req.body;

    const result = await exceptionService.operations.deleteEntityException({ programId, entity });
    return res.status(getResStatus(result)).send(result);
  }
}

const parseTSV = async (filepath: string) => {
  L.debug('parse tsv');
  const records = await TsvUtils.tsvToJson(filepath);
  if (records.length === 0) {
    throw new Errors.TSVParseError('TSV has no records');
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
