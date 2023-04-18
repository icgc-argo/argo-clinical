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

import mongoose from 'mongoose';
import { loggerFor } from '../../logger';
import { MongooseUtils, F, notEmpty } from '../../utils';
import { MigrationState, DictionaryMigration } from './migration-entities';
import { DeepReadonly } from 'deep-freeze';
const L = loggerFor(__filename);

export interface DictionaryMigrationRepository {
  getAll(): Promise<DeepReadonly<DictionaryMigration[]>>;
  create(migration: DictionaryMigration): Promise<DeepReadonly<DictionaryMigration | undefined>>;
  getByState(state: MigrationState): Promise<DeepReadonly<DictionaryMigration | undefined>>;
  getById(migrationId: string): Promise<DeepReadonly<DictionaryMigration | undefined>>;
  getLatestSuccessful(): Promise<DeepReadonly<DictionaryMigration | undefined>>;
  update(migration: DictionaryMigration): Promise<DictionaryMigration>;
}

export const migrationRepo: DictionaryMigrationRepository = {
  create: async (
    migration: DictionaryMigration,
  ): Promise<DeepReadonly<DictionaryMigration | undefined>> => {
    const doc = new DictionaryMigrationModel(migration);
    await doc.save();
    const dm = MongooseUtils.toPojo(doc) as DictionaryMigration;
    return F(dm);
  },
  getByState: async (
    state: MigrationState,
  ): Promise<DeepReadonly<DictionaryMigration | undefined>> => {
    L.debug('in migration repo get');
    const migration = await DictionaryMigrationModel.findOne({ state: state }).exec();
    if (migration == undefined) {
      return undefined;
    }
    return F(MongooseUtils.toPojo(migration) as DictionaryMigration);
  },
  getAll: async (): Promise<DeepReadonly<DictionaryMigration[]>> => {
    const migrationDocs = await DictionaryMigrationModel.find({}).exec();
    const migrations = migrationDocs
      .map(d => {
        return MongooseUtils.toPojo(d);
      })
      .filter(notEmpty);
    return F(migrations as DictionaryMigration[]);
  },
  getById: async (migrationId: string): Promise<DeepReadonly<DictionaryMigration | undefined>> => {
    L.debug('in migration repo get');
    const migration = await DictionaryMigrationModel.findOne({ _id: migrationId }).exec();
    if (migration == undefined) {
      return undefined;
    }
    return F(MongooseUtils.toPojo(migration) as DictionaryMigration);
  },
  getLatestSuccessful: async (): Promise<DeepReadonly<DictionaryMigration | undefined>> => {
    L.debug('in migration repo get latest successful');
    const migration = await DictionaryMigrationModel.find()
      .sort({ createdAt: -1 })
      .findOne({ stage: 'COMPLETED', dryRun: false })
      .exec();
    if (migration == undefined) {
      return undefined;
    }
    return F(MongooseUtils.toPojo(migration) as DictionaryMigration);
  },
  update: async (migration: DictionaryMigration): Promise<DictionaryMigration> => {
    const doc = new DictionaryMigrationModel(migration);
    doc.isNew = false;
    const updated = await doc.save();
    return updated;
  },
};

type DictionaryMigrationDocument = mongoose.Document & DictionaryMigration;

const DictionaryMigrationSchema = new mongoose.Schema(
  {
    fromVersion: { type: String, required: true },
    toVersion: { type: String, required: true },
    state: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      required: true,
    },
    stage: {
      type: String,
      enum: ['SUBMITTED', 'ANALYZED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
      required: true,
    },
    analysis: {},
    invalidDonorsErrors: [],
    invalidSubmissions: [],
    checkedSubmissions: [],
    programsWithDonorUpdates: [],
    dryRun: { type: Boolean, required: false },
    stats: {},
    createdBy: { type: String, required: true },
    newSchemaErrors: {},
  },
  { timestamps: true, minimize: false },
);

export const DictionaryMigrationModel = mongoose.model<DictionaryMigrationDocument>(
  'DictionaryMigration',
  DictionaryMigrationSchema,
);
