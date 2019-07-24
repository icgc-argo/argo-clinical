import { ActiveRegistrationModel } from "./registration";
import { ActiveRegistration } from "./submission-entities";
import { InternalError } from "./errors";
import { loggerFor } from "../logger";
import { F } from "../utils";
import { DeepReadonly } from "deep-freeze";
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
    return F(registration);
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
      return F(activeRegistration);
    } catch (err) {
      L.error("failed to fetch registration", err);
      throw new InternalError("failed to fetch registration", err);
    }
  },
  async create(registration: ActiveRegistration) {
    L.debug(`creating new registration: ${registration}`);
    const activeRegistrationModel = new ActiveRegistrationModel(registration);
    try {
      const doc = await activeRegistrationModel.save();
      registration.id = doc.id;
      L.debug(`new registration doc created: ${activeRegistrationModel}`);
      L.info(`saved new registration: program: ${registration.programId} id: ${registration.id}`);
      return F(doc);
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
