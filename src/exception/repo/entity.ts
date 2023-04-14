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
import {
  Entity,
  EntityException,
  ExceptionValue,
  ExceptionRecord,
  OnlyRequired,
  SpecimenExceptionRecord,
  FollowUpExceptionRecord,
  BaseEntityExceptionRecord,
} from '../types';
import { checkDoc } from './common';
import { RepoError, RepoResult } from './types';

const L = loggerFor(__filename);

const BaseExceptionSchema = new mongoose.Schema<ExceptionRecord>({
  program_name: String,
  schema: String,
  submitter_donor_id: String,
  requested_core_field: String,
  requested_exception_value: { type: String, enum: Object.values(ExceptionValue) },
});

const entityExceptionSchema = new mongoose.Schema<EntityException>({
  programId: String,
  specimen: [
    {
      ...BaseExceptionSchema.obj,
      submitter_specimen_id: String,
    },
  ],
  follow_up: [
    {
      ...BaseExceptionSchema.obj,
      submitter_followup_id: String,
    },
  ],
});

const EntityExceptionModel = mongoose.model<EntityException>(
  'EntityException',
  entityExceptionSchema,
);

export interface EntityExceptionRepository {
  save(exception: OnlyRequired<EntityException, 'programId'>): RepoResult<EntityException>;
  find(programId: string): RepoResult<EntityException>;
  delete(programId: string): RepoResult<EntityException>;
  deleteSingleEntity(programId: string, entity: Entity): RepoResult<EntityException>;
}

const entityExceptionRepository: EntityExceptionRepository = {
  async save(exception: OnlyRequired<EntityException, 'programId'>) {
    L.debug(`Creating new donor exception with: ${JSON.stringify(exception)}`);

    const update = { $set: exception };

    try {
      const doc = await EntityExceptionModel.findOneAndUpdate(
        { programId: exception.programId },
        update,
        { upsert: true, new: true, returnDocument: 'after' },
      ).lean(true);
      return checkDoc(doc);
    } catch (e) {
      L.error('failed to create entity exception: ', e);
      return RepoError.SERVER_ERROR;
    }
  },

  async find(programId: string) {
    L.debug(`finding entity exception with program id: ${JSON.stringify(programId)}`);
    try {
      const doc = await EntityExceptionModel.findOne({ programId }).lean(true);
      return checkDoc(doc);
    } catch (e) {
      L.error('failed to find program exception', e);
      return RepoError.SERVER_ERROR;
    }
  },

  async delete(programId: string) {
    L.debug(`deleting all entity exceptions with program id: ${JSON.stringify(programId)}`);
    try {
      const doc = await EntityExceptionModel.findOneAndDelete({ programId }).lean(true);
      return checkDoc<EntityException>(doc);
    } catch (e) {
      L.error('failed to delete exception', e);
      return RepoError.SERVER_ERROR;
    }
  },

  async deleteSingleEntity(programId: string, entity: Entity, submitterDonorIds: string[]) {
    L.debug(
      `deleting single entity ${entity} exception with program id: ${JSON.stringify(programId)}`,
    );
    try {
      const entityExceptionDoc = await EntityExceptionModel.findOne({ programId });
      if (entityExceptionDoc) {
        /**
         * typescript union array methods don't work well particulary pre v4 (currently on 3.9.5)
         * all our entity types union with BaseEntityExceptionRecord
         * filter only uses the `submitter_donor_id` field which is in BaseEntityExceptionRecord
         * explicitly adding `any` typings so it's very obvious we loose type data here
         */
        const entitiesToFilter: any = entityExceptionDoc[entity];
        const filteredEntities = entitiesToFilter.filter(
          (entity: BaseEntityExceptionRecord) =>
            !submitterDonorIds.includes(entity.submitter_donor_id),
        );
        entityExceptionDoc[entity] = filteredEntities as any;
        const doc = await entityExceptionDoc.save();
        return checkDoc(doc);
      } else {
        return RepoError.DOCUMENT_UNDEFINED;
      }
    } catch (e) {
      L.error('failed to delete exception', e);
      return RepoError.SERVER_ERROR;
    }
  },
};

export default entityExceptionRepository;
