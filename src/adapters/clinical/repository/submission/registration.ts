import { ActiveRegistrationModel } from "../../../../infra/mongoose/submission/registration";
import { CreateRegistrationCommand } from "../../../../domain/services/submission";
import { ActiveRegistration } from "../../../../domain/entities/submission";
import { InternalError } from "../../../../domain/errors";

export interface RegistrationRepository {
    delete(id: string): void;
    create(command: CreateRegistrationCommand): Promise<ActiveRegistration>;
    findByProgramId(programId: string): Promise<ActiveRegistration>;
}

// Mongoose implementation of the RegistrationRepository
export const registrationRepository: RegistrationRepository = {
    async findByProgramId(programId: string): Promise<ActiveRegistration> {
        console.debug(`in findByProgramId programId: ${programId}`);
        try {
            const activeRegistration = await ActiveRegistrationModel.findOne({ programId: programId }).exec();
            if (activeRegistration == undefined) {
                return undefined;
            }
            console.info(`found registration for program ${programId}: ${activeRegistration}`);
            return activeRegistration;
        } catch (err) {
            console.error("failed to fetch registration", err);
            throw new InternalError("failed to fetch registration", err);
        }
    },
    async create(registration: ActiveRegistration): Promise<ActiveRegistration> {
        console.debug(`creating new registration: ${registration}`);
        const activeRegistrationModel = new ActiveRegistrationModel(registration);
        try {
            const doc = await activeRegistrationModel.save();
            registration.id = doc.id;
            console.debug(`new registration doc created: ${activeRegistrationModel}`);
            console.info(`saved new registration: program: ${registration.programId} id: ${registration.id}`);
            return doc;
        } catch (err) {
            console.error("failed to save registration", err);
            throw new InternalError("failed to save registration", err);
        }
    },
    async delete(id: string): Promise<void> {
        console.debug(`in delete registration id: ${id}`);
        try {
            await ActiveRegistrationModel.deleteOne({ _id: id }).exec();
        } catch (err) {
            throw new InternalError(`failed to delete registration with Id: ${id}`, err);
        }
    }
};
