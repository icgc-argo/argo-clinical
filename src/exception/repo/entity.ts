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
import { DatabaseError } from '../error-handling';
import {
  BaseEntityExceptionRecord,
  Entity,
  EntityException,
  ExceptionRecord,
  ExceptionValue,
  OnlyRequired,
} from '../types';
import { checkDoc } from './common';

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

const entityExceptionRepository = {
  async save(exception: OnlyRequired<EntityException, 'programId'>): Promise<EntityException> {
    L.debug(`Creating new donor exception with: ${JSON.stringify(exception)}`);

    const update = { $set: exception };

    try {
      const doc = await EntityExceptionModel.findOneAndUpdate(
        { programId: exception.programId },
        update,
        { upsert: true, new: true, returnDocument: 'after' },
      ).lean(true);
      return doc;
    } catch (e) {
      L.error('failed to create entity exception: ', e);
      throw new DatabaseError('Cannot save entity exception.');
    }
  },

  async find(programId: string): Promise<EntityException | null> {
    L.debug(`finding entity exception with program id: ${JSON.stringify(programId)}`);
    try {
      // first found document, or null
      const doc = await EntityExceptionModel.findOne({ programId }).lean(true);
      return doc;
    } catch (e) {
      L.error('failed to find program exception', e);
      throw new DatabaseError();
    }
  },

  async delete(programId: string) {
    L.debug(`deleting all entity exceptions with program id: ${JSON.stringify(programId)}`);
    try {
      const doc = await EntityExceptionModel.findOneAndDelete({ programId }).lean(true);
      return checkDoc<EntityException>(doc);
    } catch (e) {
      L.error('failed to delete exception', e);
      throw new DatabaseError('Cannot save entity exception.');
    }
  },

  async deleteSingleEntity(
    programId: string,
    entity: Entity,
    submitterDonorIds: string[],
  ): Promise<EntityException | null> {
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
        return doc;
      }
      // mongo will return nulls for non existent docs
      // tslint doesn't complain about a null from a lib
      // tslint:disable-next-line
      return null;
    } catch (e) {
      L.error('failed to delete exception', e);
      throw new DatabaseError('Cannot save entity exception.');
    }
  },
};

export default entityExceptionRepository;
