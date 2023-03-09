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
import { isArray } from 'lodash';
import mongoose from 'mongoose';
import { loggerFor } from '../../logger';
import { ExceptionValue, ProgramException } from '../types';
import { checkDoc } from './common';
import { RepoResponse, RepoError } from './types';

const L = loggerFor(__filename);

const programExceptionSchema = new mongoose.Schema<ProgramException>({
  programId: String,
  exceptions: [
    {
      schema: String,
      coreField: String,
      exceptionValue: { type: String, enum: Object.values(ExceptionValue) },
    },
  ],
});

const ProgramExceptionModel = mongoose.model<ProgramException>(
  'ProgramException',
  programExceptionSchema,
);

export interface ProgramExceptionRepository {
  save(exception: ProgramException): RepoResponse<ProgramException>;
  find(programId: string): RepoResponse<ProgramException>;
  delete(programId: string): RepoResponse<ProgramException>;
}

const programExceptionRepository: ProgramExceptionRepository = {
  async save(exception: ProgramException) {
    L.debug(`Creating new program exception with: ${JSON.stringify(exception)}`);
    try {
      return await ProgramExceptionModel.findOneAndUpdate(
        { programId: exception.programId },
        exception,
        { upsert: true, new: true, overwrite: true },
      ).lean(true);
      // L.info(`doc created ${doc}`);
    } catch (e) {
      L.error('failed to create program exception: ', e);
      return RepoError.SERVER_ERROR;
    }
  },

  async find(programId: string) {
    L.debug(`finding program exception with id: ${JSON.stringify(programId)}`);
    try {
      const doc = await ProgramExceptionModel.findOne({ programId }).lean(true);
      return checkDoc(doc);
    } catch (e) {
      L.error('failed to find program exception', e);
      return RepoError.SERVER_ERROR;
    }
  },

  async delete(programId: string) {
    L.debug(`deleting program exception with program id: ${JSON.stringify(programId)}`);
    try {
      const doc = await ProgramExceptionModel.findOneAndDelete({ programId }).lean(true);
      return checkDoc(doc);
    } catch (e) {
      L.error('failed to delete program exception', e);
      return RepoError.SERVER_ERROR;
    }
  },
};

export default programExceptionRepository;
