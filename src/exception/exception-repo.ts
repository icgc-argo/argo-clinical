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
import { F, MongooseUtils } from '../utils';
import { loggerFor } from '../logger';
import { DeepReadonly } from 'deep-freeze';

const L = loggerFor(__filename);

const ExceptionSchema = new mongoose.Schema({
  schema: { type: String, required: true },
  coreField: { type: String, required: true },
  exceptionValue: { type: String, enum: ['Unknown', 'Missing', 'Not applicable'], required: true },
});

const ProgramExceptionSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  exceptions: { type: [ExceptionSchema], required: true },
});

type ProgramExceptionDocument = mongoose.Document & ProgramException;

export const ProgramExceptionModel = mongoose.model<ProgramExceptionDocument>(
  'ProgramException',
  ProgramExceptionSchema,
);

interface ProgramExceptionItem {
  schema: string;
  coreField: string;
  exceptionValue: string;
}

export interface ProgramException {
  name: string;
  exceptions: ProgramExceptionItem[];
}

export interface ProgramExceptionRepository {
  create(programException: ProgramException): Promise<DeepReadonly<ProgramException>>;
  find(name: string): Promise<DeepReadonly<ProgramException> | undefined>;
  update(programException: ProgramException): Promise<DeepReadonly<ProgramException> | undefined>;
  delete(name: string): Promise<void>;
}

export const programExceptionRepository: ProgramExceptionRepository = {
  async create(req: ProgramException) {
    L.debug(`Creating new program exception with: ${JSON.stringify(req)}`);
    const exception: ProgramException = { ...req };
    const programException = new ProgramExceptionModel(exception);
    try {
      const doc = await programException.save();
      L.info(`doc created ${doc}`);
      L.info('saved program exception');
      return F(MongooseUtils.toPojo(doc) as ProgramException);
    } catch (e) {
      L.error('failed to create program exception', e);
      throw new Error('failed to create program exception');
    }
  },

  async find(name: string) {
    L.debug(`finding program exception with name: ${JSON.stringify(name)}`);
    try {
      const doc = await ProgramExceptionModel.findOne({ name });
      if (doc) {
        L.info(`doc found ${doc}`);
        return F(MongooseUtils.toPojo(doc) as ProgramException);
      }
    } catch (e) {
      L.error('failed to find program exception', e);
      throw new Error(`failed to find program exception with name: ${JSON.stringify(name)}`);
    }
  },

  // update replaces entire program exceptions record
  async update(programException: ProgramException) {
    L.debug(
      `finding program exception with program name: ${JSON.stringify(programException.name)}`,
    );
    try {
      const doc = await ProgramExceptionModel.replaceOne(
        { name: programException.name },
        programException,
      );
      if (doc) {
        L.info(`doc found ${doc}`);
        return F(MongooseUtils.toPojo(doc) as ProgramException);
      }
    } catch (e) {
      L.error('failed to find program exception', e);
      throw new Error(`failed to update program exception with name: ${JSON.stringify(name)}`);
    }
  },

  async delete(name: string) {
    L.debug(`deleting program exception with program name: ${JSON.stringify(name)}`);
    try {
      await ProgramExceptionModel.findOneAndDelete({ name });
    } catch (e) {
      L.error('failed to find program exception', e);
      throw new Error(`failed to delete program exception with name: ${JSON.stringify(name)}`);
    }
  },
};
