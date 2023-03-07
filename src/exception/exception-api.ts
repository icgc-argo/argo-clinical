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
import { ControllerUtils, TsvUtils } from '../utils';
import { RepoError } from './exception-repo';
import * as exceptionService from './exception-service';
import { isReadonlyArrayOf } from './types';

const L = loggerFor(__filename);

const ProgramExceptionErrorMessage = {
  TSV_PARSING_FAILED: `This file is formatted incorrectly`,
} as const;

function getResStatus(result: exceptionService.Result): number {
  if (result.success) {
    return 200;
  } else if (result.error?.code === RepoError.DOCUMENT_UNDEFINED) {
    return 400;
  } else {
    return 500;
  }
}

class ExceptionController {
  @HasFullWriteAccess()
  // program level exceptions
  async createProgramException(req: Request, res: Response) {
    const programId = req.params.programId;
    const records = res.locals.records;

    const result = await exceptionService.operations.createProgramException({
      programId,
      records,
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

  // donor level exceptions
  async createDonorException(req: Request, res: Response) {
    // check if program exception exists
    // const programExceptionExists = await exceptioncheckProgramException();

    return res.status(400).send({});
  }
}

export const parseTSV = (guard: any) => async (req: Request, res: Response, next: NextFunction) => {
  L.debug('parse tsv');
  try {
    const records = await TsvUtils.tsvToJson(req.file.path);
    if (records.length === 0) {
      throw new Error('TSV has no records!');
    }

    if (!isReadonlyArrayOf(records, guard)) {
      throw new Error('TSV is incorrectly structured');
    }

    res.locals.records = records;
  } catch (err) {
    L.error(`Program Exception TSV_PARSING_FAILED`, err);
    return ControllerUtils.unableToProcess(res, ProgramExceptionErrorMessage.TSV_PARSING_FAILED);
  }
  next();
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
