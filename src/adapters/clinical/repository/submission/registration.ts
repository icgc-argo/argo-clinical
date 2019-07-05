import { ActiveRegistrationModel } from "../../../../infra/mongoose/submission/registration";
import { CreateRegistrationCommand } from "../../../../domain/services/submission";
import { ActiveRegistration, RegistrationRecord } from "../../../../domain/entities/submission";

export interface RegistrationRepository {
    create(command: CreateRegistrationCommand): Promise<ActiveRegistration>;
    findByProgramId(programId: string): Promise<ActiveRegistration>;
}

export interface CreateRegistrationDto {

}

export const registrationRepository: RegistrationRepository = {
    async findByProgramId(programId: string): Promise<ActiveRegistration> {
        console.debug("in findByProgramId programId: ", programId);
        const activeRegistration = await ActiveRegistrationModel.findOne({ programId: programId }).exec();
        console.info("found program: ", activeRegistration);
        return activeRegistration;
    },
    async create(registration: ActiveRegistration): Promise<ActiveRegistration> {
        console.debug("creating new registration: ", registration);
        const activeRegistrationModel = new ActiveRegistrationModel(registration);
        const doc = await activeRegistrationModel.save();
        registration.id = doc.id;
        console.debug("new registration doc created: ", activeRegistrationModel);
        console.info("saved new registration: program: ", registration.programId, " id: ", registration.id);
        return doc;
    }
};
