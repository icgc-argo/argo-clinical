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

import { Request, Response } from 'express';
import { HasFullReadAccess, HasFullWriteAccess } from '../decorators';
import { loggerFor } from '../logger';
import { ControllerUtils, TsvUtils } from '../utils';
import { programExceptionRepository } from './exception-repo';
import * as exceptionService from './exception-service';
import { isProgramExceptionRecord, isReadonlyArrayOf } from './types';

const L = loggerFor(__filename);

const ProgramExceptionErrorMessage = {
  TSV_PARSING_FAILED: `This file is formatted incorrectly`,
} as const;

class ExceptionController {
  @HasFullWriteAccess()
  async clearProgramException(req: Request, res: Response) {
    const programId = req.params.programId;
    try {
      const result = await programExceptionRepository.delete(programId);
      return res.status(200).send();
    } catch (e) {
      return res.status(404).send();
    }
  }

  @HasFullWriteAccess()
  async createProgramException(req: Request, res: Response) {
    if (!requestContainsFile(req, res)) {
      return false;
    }

    const programId = req.params.programId;
    const file = req.file;

    try {
      const records = await TsvUtils.tsvToJson(file.path);
      if (records.length === 0) {
        throw new Error('TSV has no records!');
      }
      console.log('res', JSON.stringify(records));

      if (!isReadonlyArrayOf(records, isProgramExceptionRecord)) {
        throw new Error('TSV is incorrectly structured');
      }

      const result = await exceptionService.operations.createProgramException({
        programId,
        records,
      });

      if (!result.successful) {
        return res.status(422).send(result);
      }
      return res.status(201).send(result);
    } catch (err) {
      L.error(`Program Exception TSV_PARSING_FAILED`, err);
      return ControllerUtils.unableToProcess(res, ProgramExceptionErrorMessage.TSV_PARSING_FAILED);
    }
  }

  @HasFullReadAccess()
  async getProgramException(req: Request, res: Response) {
    const programId = req.params.programId;
    try {
      const exception = await programExceptionRepository.find(programId);
      res.status(200).send(exception);
    } catch (e) {
      res.status(200).send({});
    }
  }
}

const requestContainsFile = (req: Request, res: Response): boolean => {
  if (req.file === undefined || req.file.size <= 0) {
    L.debug(`File missing`);
    ControllerUtils.badRequest(res, `Program exception file upload required`);
    return false;
  }
  return true;
};

export default new ExceptionController();
