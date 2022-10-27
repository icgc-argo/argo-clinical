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
import mongoose from 'mongoose';
import { MongooseUtils } from '../utils';
import { loggerFor } from '../logger';
import { DeepReadonly } from 'deep-freeze';
import { ExceptionValue, ProgramException } from './types';

const L = loggerFor(__filename);

const programExceptionSchema = new mongoose.Schema({
  programId: String,
  exceptions: [
    {
      schema: String,
      coreField: String,
      exceptionValue: { type: String, enum: Object.values(ExceptionValue) },
    },
  ],
});

type ProgramExceptionDocument = mongoose.Document & ProgramException;

export const ProgramExceptionModel = mongoose.model<ProgramExceptionDocument>(
  'ProgramException',
  programExceptionSchema,
);

export interface ProgramExceptionRepository {
  create(exception: ProgramException): Promise<DeepReadonly<ProgramException>>;
  find(programId: string): Promise<DeepReadonly<ProgramException> | undefined>;
  delete(name: string): Promise<void>;
}

export const programExceptionRepository: ProgramExceptionRepository = {
  async create(exception: ProgramException) {
    L.debug(`Creating new program exception with: ${JSON.stringify(exception)}`);
    try {
      const doc = await ProgramExceptionModel.findOneAndUpdate(
        { programId: exception.programId },
        exception,
        { upsert: true, new: true, overwrite: true },
      );
      L.info(`doc created ${doc}`);
      L.info('saved program exception');
      return MongooseUtils.toPojo(doc) as ProgramException;
    } catch (e) {
      L.error('failed to create program exception: ', e);
      throw new Error('failed to create program exception');
    }
  },

  async find(programId: string) {
    L.debug(`finding program exception with id: ${JSON.stringify(programId)}`);
    try {
      const doc = await ProgramExceptionModel.findOne({ programId });
      if (doc) {
        L.info(`doc found ${doc}`);
        return MongooseUtils.toPojo(doc) as ProgramException;
      }
    } catch (e) {
      L.error('failed to find program exception', e);
      throw new Error(`failed to find program exception with name: ${JSON.stringify(programId)}`);
    }
  },

  async delete(programId: string) {
    L.debug(`deleting program exception with program id: ${JSON.stringify(programId)}`);
    try {
      await ProgramExceptionModel.findOneAndDelete({ programId });
    } catch (e) {
      L.error('failed to find program exception', e);
      throw new Error(`failed to delete program exception with name: ${JSON.stringify(programId)}`);
    }
  },
};
