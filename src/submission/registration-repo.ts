import { ActiveRegistration } from "./submission-entities";
import { InternalError } from "./errors";
import { loggerFor } from "../logger";
import { F, MongooseUtils } from "../utils";
import * as _ from "lodash";
import { DeepReadonly } from "deep-freeze";
import mongoose from "mongoose";
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
      L.error("failed to save registration", err);
      throw new InternalError("failed to save registration", err);
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
  }
};

type ActiveRegistrationDocument = mongoose.Document & ActiveRegistration;

const ActiveRegistrationItem = new mongoose.Schema(
  {
    program_id: { type: String, required: true },
    donor_submitter_id: { type: String, required: true },
    gender: { type: String, required: true },
    specimen_submitter_id: { type: String, required: true },
    specimen_type: { type: String, required: true },
    tumour_normal_designation: { type: String, required: true },
    sample_submitter_id: { type: String, required: true },
    sample_type: { type: String, required: true }
  },
  { _id: false }
);

const ActiveRegistrationSchema = new mongoose.Schema(
  {
    programId: { type: String, unique: true, required: true },
    creator: { type: String },
    status: { type: String },
    stats: { type: Object },
    records: [ActiveRegistrationItem]
  },
  { timestamps: true }
);

export const ActiveRegistrationModel = mongoose.model<ActiveRegistrationDocument>(
  "ActiveRegistration",
  ActiveRegistrationSchema
);
