import { ActiveRegistrationModel } from "../../../../infra/mongoose/submission/registration";
import { CreateRegistrationCommand } from "../../../../domain/services/submission";
import { ActiveRegistration, RegistrationRecord } from "../../../../domain/entities/submission";

export interface RegistrationRepository {
    create(command: CreateRegistrationCommand): Promise<ActiveRegistration>;
    findByProgramId(programId: string): Promise<ActiveRegistration>;
}

export const registrationRepository: RegistrationRepository = {
    async findByProgramId(programId: string): Promise<ActiveRegistration> {
        console.debug("in findByProgramId programId: ", programId);
        const activeRegistration = await ActiveRegistrationModel.findOne({ programId: programId }).exec();
        console.info("found program: ", activeRegistration);
        return activeRegistration;
    },
    async create(command: CreateRegistrationCommand): Promise<ActiveRegistration> {
        console.debug("creating new registration: ", command);
        const registration: ActiveRegistration = {
            programId: command.programId,
            creator: command.creator,
            records: command.records.map(r => {
                const record: RegistrationRecord = {
                    donorSubmitterId: r.donorSubmitterId,
                    gender: r.gender,
                    specimenSubmitterId: r.specimenSubmitterId,
                    specimenType: r.specimenType,
                    tumorNormalDesignation: r.tumorNormalDesignation,
                    sampleSubmitterId: r.sampleSubmitterId,
                    sampleType: r.sampleType
                };
                return record;
            })
        };
        const activeRegistrationModel = new ActiveRegistrationModel(registration);
        const doc = await activeRegistrationModel.save();
        registration.id = doc.id;
        console.debug("new registration doc created: ", activeRegistrationModel);
        console.info("saved new registration: program: ", registration.programId, " id: ", registration.id);
        return doc;
    }
};
