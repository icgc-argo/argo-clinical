import { loggerFor } from "../logger";
import mongoose from "mongoose";
import { DeepReadonly } from "deep-freeze";
import { ActiveSubmission } from "./submission-entities";
import { MongooseUtils, F } from "../utils";
import { InternalError } from "./errors";
import _ from "lodash";
const L = loggerFor(__filename);

export interface WorkspaceRepository {
  delete(id: string): Promise<void>;
  create(command: DeepReadonly<ActiveSubmission>): Promise<DeepReadonly<ActiveSubmission>>;
  findByProgramId(programId: string): Promise<DeepReadonly<ActiveSubmission> | undefined>;
  findById(id: string): Promise<DeepReadonly<ActiveSubmission> | undefined>;
  update(command: DeepReadonly<ActiveSubmission>): Promise<void>;
  // clear(id: string): Promise<ActiveSubmission> | undefined;
}

// Mongoose implementation of the RegistrationRepository
export const workspaceRepository: WorkspaceRepository = {
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
        programId: programId
      }).exec();
      if (activeRegistration == undefined) {
        return undefined;
      }
      L.info(`found registration for program ${programId}: ${activeRegistration}`);
      return F(MongooseUtils.toPojo(activeRegistration));
    } catch (err) {
      L.error("failed to fetch registration", err);
      throw new InternalError("failed to fetch registration", err);
    }
  },
  // forceCreate? singletonCreate?
  async create(submission: DeepReadonly<ActiveSubmission>) {
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
  async update(command: DeepReadonly<ActiveSubmission>): Promise<void> {
    const activeSubmissionModel = new ActiveSubmissionModel(command);
    await activeSubmissionModel.updateOne(activeSubmissionModel);
  }
};

const clinicalEntity = new mongoose.Schema(
  {
    batchName: { type: String, required: true },
    creator: { type: String, required: true },
    records: [],
    schemaErrors: [],
    stats: {
      new: [Number],
      noUpdate: [Number],
      Updated: [Number],
      errorsFound: [Number]
    }
  },
  { _id: false, minimize: false, timestamps: true }
);

type ActiveSubmissionDocument = mongoose.Document & ActiveSubmission;

const ActiveSubmissionSchema = new mongoose.Schema(
  {
    programId: { type: String, required: true },
    state: {
      type: String,
      enum: ["OPEN", "VALID", "INVALID", "PENDING_APPROVAL"],
      default: "OPEN",
      required: true
    },
    hashVersion: { type: String, default: "42" },
    clinicalEntities: { type: Object, required: false }
  },
  { timestamps: true, minimize: false }
);

export const ActiveSubmissionModel = mongoose.model<ActiveSubmissionDocument>(
  "ActiveSubmission",
  ActiveSubmissionSchema
);
