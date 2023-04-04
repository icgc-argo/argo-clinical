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

import { loggerFor } from '../logger';
import mongoose from 'mongoose';
import { DeepReadonly } from 'deep-freeze';
import { ActiveClinicalSubmission, SUBMISSION_STATE } from './submission-entities';
import { MongooseUtils, F, Errors } from '../utils';
import { InternalError } from './errors';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
const L = loggerFor(__filename);

export interface ClinicalSubmissionRepository {
  findAll(): Promise<DeepReadonly<ActiveClinicalSubmission[]>>;
  delete(id: string): Promise<void>;
  deleteByProgramIdAndVersion(args: { programId: string; version: string }): Promise<void>;
  deleteByProgramId(id: string): Promise<void>;
  create(
    command: DeepReadonly<ActiveClinicalSubmission>,
  ): Promise<DeepReadonly<ActiveClinicalSubmission>>;
  findByProgramId(programId: string): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined>;
  findById(id: string): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined>;
  updateSubmissionStateWithVersion(
    programId: string,
    version: string,
    updatedBy: string,
    state: SUBMISSION_STATE,
  ): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined>;
  updateSubmissionWithVersion(
    programId: string,
    version: string,
    updatedSubmission: DeepReadonly<ActiveClinicalSubmission>,
  ): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined>;
  updateSubmissionFieldsWithVersion(
    programId: string,
    version: string,
    updatingFields: object,
  ): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined>;
}

// Mongoose implementation of the ClinicalSubmissionRepository
export const submissionRepository: ClinicalSubmissionRepository = {
  async findAll() {
    const activeSubmissions = await ActiveSubmissionModel.find({}).exec();
    return activeSubmissions.map((as: any) =>
      F(MongooseUtils.toPojo(as) as ActiveClinicalSubmission),
    );
  },
  async findById(id: string) {
    const registration = await ActiveSubmissionModel.findById(id);
    if (registration === null) {
      return undefined;
    }
    return F(MongooseUtils.toPojo(registration) as ActiveClinicalSubmission);
  },
  async findByProgramId(programId: string) {
    L.debug(`in findByProgramId programId: ${programId}`);
    try {
      const activeSubmission = await ActiveSubmissionModel.findOne({
        programId: programId,
      }).exec();
      if (activeSubmission == undefined) {
        return undefined;
      }
      L.debug(`found submission for program ${programId}: ${activeSubmission.version}`);
      return F(MongooseUtils.toPojo(activeSubmission) as ActiveClinicalSubmission);
    } catch (err) {
      L.error('failed to fetch submission', err as Error);
      throw new InternalError('failed to fetch submission', err as Error);
    }
  },
  // forceCreate? singletonCreate?
  async create(submission: DeepReadonly<ActiveClinicalSubmission>) {
    const newsubmission = new ActiveSubmissionModel(submission);
    await newsubmission.save();
    return F(MongooseUtils.toPojo(newsubmission) as ActiveClinicalSubmission);
  },
  async delete(id: string): Promise<void> {
    L.debug(`in delete registration id: ${id}`);
    try {
      await ActiveSubmissionModel.deleteOne({ _id: id }).exec();
      return;
    } catch (err) {
      throw new InternalError(`failed to delete ActiveSubmission with Id: ${id}`, err as Error);
    }
  },
  async deleteByProgramId(programId: string): Promise<void> {
    L.debug(`in deleteByProgramId for activeSubmission programId: ${programId}`);
    try {
      await ActiveSubmissionModel.deleteOne({ programId }).exec();
      return;
    } catch (err) {
      throw new InternalError(
        `failed to delete ActiveSubmission with programId: ${programId}`,
        err as Error,
      );
    }
  },
  async updateSubmissionStateWithVersion(
    programId: string,
    version: string,
    updatedBy: string,
    state: SUBMISSION_STATE,
  ): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined> {
    return await this.updateSubmissionFieldsWithVersion(programId, version, { state, updatedBy });
  },
  async updateSubmissionWithVersion(
    programId: string,
    version: string,
    updatedSubmission: DeepReadonly<ActiveClinicalSubmission>,
  ): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined> {
    return await this.updateSubmissionFieldsWithVersion(programId, version, updatedSubmission);
  },
  async deleteByProgramIdAndVersion(args: { programId: string; version: string }): Promise<void> {
    await ActiveSubmissionModel.findOneAndDelete({
      programId: args.programId,
      version: args.version,
    });
    return;
  },
  // this is bassically findOneAndUpdate but with new version everytime
  async updateSubmissionFieldsWithVersion(
    programId: string,
    version: string,
    updatingFields: ActiveClinicalSubmission,
  ): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined> {
    try {
      const newVersion = uuidv4();
      const updated = (await ActiveSubmissionModel.findOneAndUpdate(
        { programId, version },
        { ...updatingFields, version: newVersion },
        { new: true },
      )) as ActiveClinicalSubmission;
      if (!updated) {
        throw new Errors.StateConflict("Couldn't update program.");
      }
      return updated;
    } catch (err) {
      throw new InternalError(
        `failed to update ActiveSubmission with programId: ${programId} & version: ${version}`,
        err as Error,
      );
    }
  },
};

type ActiveClinicalSubmissionDocument = mongoose.Document & ActiveClinicalSubmission;

const ActiveSubmissionSchema = new mongoose.Schema(
  {
    programId: { type: String, unique: true, required: true },
    state: {
      type: String,
      enum: ['OPEN', 'VALID', 'INVALID', 'PENDING_APPROVAL'],
      default: 'OPEN',
      required: true,
    },
    version: { type: String, required: true },
    clinicalEntities: { type: Object, required: false },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true, minimize: false },
);

// If a findOneAndUpdate query object has updatedAt being set to something,
// this pre hook will ensure it is actually set to the current time
ActiveSubmissionSchema.pre('findOneAndUpdate', function(next) {
  const newsubmission = this.getUpdate() as ActiveClinicalSubmission;
  if (newsubmission.updatedAt) {
    newsubmission.updatedAt = new Date();
  }
  next();
});

export const ActiveSubmissionModel = mongoose.model<ActiveClinicalSubmissionDocument>(
  'ActiveSubmission',
  ActiveSubmissionSchema,
);
