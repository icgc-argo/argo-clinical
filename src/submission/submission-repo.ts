import { loggerFor } from '../logger';
import mongoose from 'mongoose';
import { DeepReadonly } from 'deep-freeze';
import { ActiveClinicalSubmission, SUBMISSION_STATE } from './submission-entities';
import { MongooseUtils, F } from '../utils';
import { InternalError } from './errors';
import _ from 'lodash';
const L = loggerFor(__filename);

export interface ClinicalSubmissionRepository {
  delete(id: string): Promise<void>;
  deleteByProgramId(id: string): Promise<void>;
  create(
    command: DeepReadonly<ActiveClinicalSubmission>,
  ): Promise<DeepReadonly<ActiveClinicalSubmission>>;
  findByProgramId(programId: string): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined>;
  findById(id: string): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined>;
  update(command: DeepReadonly<ActiveClinicalSubmission>): Promise<void>;
  updateState(programId: string, state: SUBMISSION_STATE): Promise<void>;
  updateProgramWithVersion(
    programId: string,
    version: string,
    updatedSubmission: DeepReadonly<ActiveClinicalSubmission>,
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
      const activeRegistration = await ActiveSubmissionModel.findOne({
        programId: programId,
      }).exec();
      if (activeRegistration == undefined) {
        return undefined;
      }
      L.info(`found registration for program ${programId}: ${activeRegistration}`);
      return F(MongooseUtils.toPojo(activeRegistration));
    } catch (err) {
      L.error('failed to fetch registration', err);
      throw new InternalError('failed to fetch registration', err);
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
  async update(command: DeepReadonly<ActiveClinicalSubmission>): Promise<void> {
    const activeSubmissionModel = new ActiveSubmissionModel(command);
    await activeSubmissionModel.updateOne(activeSubmissionModel);
  },
  async updateState(programId: string, state: SUBMISSION_STATE) {
    await ActiveSubmissionModel.findOneAndUpdate({ programId: programId }, { state: state });
  },
  async updateProgramWithVersion(
    programId: string,
    version: string,
    updatedSubmission: DeepReadonly<ActiveClinicalSubmission>,
  ): Promise<DeepReadonly<ActiveClinicalSubmission> | undefined> {
    return (
      (await ActiveSubmissionModel.findOneAndUpdate(
        { programId: programId, version: version },
        updatedSubmission,
        { new: true },
      )) || undefined
    );
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

export const ActiveSubmissionModel = mongoose.model<ActiveClinicalSubmissionDocument>(
  'ActiveSubmission',
  ActiveSubmissionSchema,
);
