/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
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

import { ActiveRegistration, SampleRegistrationFieldsEnum } from './submission-entities';
import { InternalError } from './errors';
import { loggerFor } from '../logger';
import { F, MongooseUtils } from '../utils';
import _ from 'lodash';
import { DeepReadonly } from 'deep-freeze';
import mongoose from 'mongoose';
const L = loggerFor(__filename);

export interface RegistrationRepository {
  delete(id: string): Promise<void>;
  create(command: DeepReadonly<ActiveRegistration>): Promise<DeepReadonly<ActiveRegistration>>;
  findByProgramId(programId: string): Promise<DeepReadonly<ActiveRegistration> | undefined>;
  findById(id: string): Promise<DeepReadonly<ActiveRegistration> | undefined>;
}

// Mongoose implementation of the RegistrationRepository
export const registrationRepository: RegistrationRepository = {
  async findById(id: string) {
    const registration = await ActiveRegistrationModel.findById(id);
    if (registration === null) {
      return undefined;
    }
    return F(MongooseUtils.toPojo(registration));
  },
  async findByProgramId(programId: string) {
    L.debug(`in findByProgramId programId: ${programId}`);
    try {
      const activeRegistration = await ActiveRegistrationModel.findOne({
        programId: programId,
      }).exec();
      if (activeRegistration == undefined) {
        return undefined;
      }
      L.info(`found registration for program ${programId}: ${activeRegistration._id}`);
      return F(MongooseUtils.toPojo(activeRegistration));
    } catch (err) {
      L.error('failed to fetch registration', err);
      throw new InternalError('failed to fetch registration', err);
    }
  },
  async create(toSave: DeepReadonly<ActiveRegistration>) {
    const registration: ActiveRegistration = _.cloneDeep(toSave as ActiveRegistration);
    L.debug(`creating new registration: ${JSON.stringify(registration)}`);
    const activeRegistrationModel = new ActiveRegistrationModel(registration);
    try {
      const doc = await activeRegistrationModel.save();
      L.debug(`new registration doc created: ${doc}`);
      L.info(`saved new registration: program: ${doc.programId} id: ${doc._id}`);
      return F(MongooseUtils.toPojo(doc));
    } catch (err) {
      L.error('failed to save registration', err);
      throw new InternalError('failed to save registration', err);
    }
  },
  async delete(id: string): Promise<void> {
    L.debug(`in delete registration id: ${id}`);
    try {
      await ActiveRegistrationModel.deleteOne({ _id: id }).exec();
      return;
    } catch (err) {
      throw new InternalError(`failed to delete registration with Id: ${id}`, err);
    }
  },
};

type ActiveRegistrationDocument = mongoose.Document & ActiveRegistration;

const ActiveRegistrationItem = new mongoose.Schema(
  {
    [SampleRegistrationFieldsEnum.program_id]: { type: String, unique: true, required: true },
    [SampleRegistrationFieldsEnum.submitter_donor_id]: { type: String, required: true },
    [SampleRegistrationFieldsEnum.gender]: { type: String, required: true },
    [SampleRegistrationFieldsEnum.submitter_specimen_id]: { type: String, required: true },
    [SampleRegistrationFieldsEnum.specimen_tissue_source]: { type: String, required: true },
    [SampleRegistrationFieldsEnum.tumour_normal_designation]: { type: String, required: true },
    [SampleRegistrationFieldsEnum.specimen_type]: { type: String, required: true },
    [SampleRegistrationFieldsEnum.submitter_sample_id]: { type: String, required: true },
    [SampleRegistrationFieldsEnum.sample_type]: { type: String, required: true },
  },
  { _id: false, minimize: false },
);

const ActiveRegistrationSchema = new mongoose.Schema(
  {
    programId: { type: String, unique: true, required: true },
    creator: { type: String },
    batchName: { type: String },
    status: { type: String },
    stats: { type: Object },
    records: [ActiveRegistrationItem],
    schemaVersion: { type: String, required: true },
  },
  { timestamps: true, minimize: false },
);

export const ActiveRegistrationModel = mongoose.model<ActiveRegistrationDocument>(
  'ActiveRegistration',
  ActiveRegistrationSchema,
);
