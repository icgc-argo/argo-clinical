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
import { loggerFor } from '../../logger';
import { EntityException, ExceptionValue } from '../types';
import { RepoError, RepoResponse } from './types';

const L = loggerFor(__filename);

const entityExceptionSchema = new mongoose.Schema<EntityException>({
  programId: String,
  specimen: [
    {
      program_name: String,
      schema: String,
      requested_core_field: String,
      requested_exception_value: { type: String, enum: Object.values(ExceptionValue) },
      submitter_donor_id: String,
      submitter_specimen_id: String,
    },
  ],
});

const EntityExceptionModel = mongoose.model<EntityException>(
  'EntityException',
  entityExceptionSchema,
);

export interface EntityExceptionRepository {
  save(exception: EntityException): RepoResponse<EntityException>;
}

const entityExceptionRepository: EntityExceptionRepository = {
  async save(exception: EntityException) {
    L.debug(`Creating new donor exception with: ${JSON.stringify(exception)}`);

    const update = { $set: { programId: exception.programId, specimen: exception.specimen } };

    try {
      return await EntityExceptionModel.findOneAndUpdate(
        { programId: exception.programId },
        update,
        { upsert: true, new: true },
      ).lean(true);
      // L.info(`doc created ${doc}`);
    } catch (e) {
      L.error('failed to create entity exception: ', e);
      return RepoError.SERVER_ERROR;
    }
  },
};

export default entityExceptionRepository;
