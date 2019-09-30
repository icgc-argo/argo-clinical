import { loggerFor } from '../logger';
import mongoose from 'mongoose';
import { DeepReadonly } from 'deep-freeze';
import { ActiveClinicalSubmission, SUBMISSION_STATE } from './submission-entities';
import { MongooseUtils, F, Errors } from '../utils';
import { InternalError } from './errors';
import _ from 'lodash';
import uuid from 'uuid';
const L = loggerFor(__filename);

export interface ClinicalSubmissionRepository {
  delete(id: string): Promise<void>;
  deleteByProgramId(id: string): Promise<void>;
  create(
    command: DeepReadonly<ActiveClinicalSubmission>,
  ): Promise<DeepReadonly<ActiveClinicalSubmission>>;
  findByProgramId(programId: string): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined>;
  findById(id: string): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined>;
  updateSubmissionStateWithVersion(
    programId: string,
    version: string,
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
  async findById(id: string) {
    const registration = await ActiveSubmissionModel.findById(id);
    if (registration === null) {
      return undefined;
    }
    return F(MongooseUtils.toPojo(registration));
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
      L.info(`found submission for program ${programId}: ${activeSubmission}`);
      return F(MongooseUtils.toPojo(activeSubmission));
    } catch (err) {
      L.error('failed to fetch submission', err);
      throw new InternalError('failed to fetch submission', err);
    }
  },
  // forceCreate? singletonCreate?
  async create(submission: DeepReadonly<ActiveClinicalSubmission>) {
    const newsubmission = new ActiveSubmissionModel(submission);
    await newsubmission.save();
    return F(MongooseUtils.toPojo(newsubmission));
  },
  async delete(id: string): Promise<void> {
    L.debug(`in delete registration id: ${id}`);
    try {
      await ActiveSubmissionModel.deleteOne({ _id: id }).exec();
      return;
    } catch (err) {
      throw new InternalError(`failed to delete ActiveSubmission with Id: ${id}`, err);
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
        err,
      );
    }
  },
  async updateSubmissionStateWithVersion(
    programId: string,
    version: string,
    state: SUBMISSION_STATE,
  ): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined> {
    return await this.updateSubmissionFieldsWithVersion(programId, version, { state });
  },
  async updateSubmissionWithVersion(
    programId: string,
    version: string,
    updatedSubmission: DeepReadonly<ActiveClinicalSubmission>,
  ): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined> {
    return await this.updateSubmissionFieldsWithVersion(programId, version, updatedSubmission);
  },
  // this is bassically findOneAndUpdate but with new version everytime
  async updateSubmissionFieldsWithVersion(
    programId: string,
    version: string,
    updatingFields: object,
  ): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined> {
    try {
      const newVersion = uuid();
      const updated = await ActiveSubmissionModel.findOneAndUpdate(
        { programId: programId, version: version },
        { ...updatingFields, version: newVersion },
        { new: true },
      );
      if (!updated) {
        throw new Errors.StateConflict("Couldn't update program.");
      }
      return updated;
    } catch (err) {
      throw new InternalError(
        `failed to delete ActiveSubmission with programId: ${programId}`,
        err,
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
  },
  { timestamps: true, minimize: false },
);

// If a findOneAndUpdate query object has updatedAt being set to something,
// this pre hook will ensure it is actually set to the current time
ActiveSubmissionSchema.pre('findOneAndUpdate', function(next) {
  const newsubmission = this.getUpdate();
  if (newsubmission.updatedAt) {
    newsubmission.updatedAt = Date.now();
  }
  next();
});

export const ActiveSubmissionModel = mongoose.model<ActiveClinicalSubmissionDocument>(
  'ActiveSubmission',
  ActiveSubmissionSchema,
);
