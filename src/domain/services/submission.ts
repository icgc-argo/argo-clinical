import  * as schemaSvc from "./schema";
import * as dataValidator from "./validation";
import { donorDao } from "../../adapters/clinical/repository/clinical/donor";
import { registrationDao } from "../../adapters/clinical/repository/submission/registration";
import { Donor } from "../entities/clinical";
import { RegisterDonorDto } from "../../adapters/clinical/repository/clinical/donor";

export namespace operations {
    /**
     * This method creates an in progress registration after validating but doesn't create the donors in the donor collection
     * it overrides and closes any previously uncomitted registrations.
     * @param command CreateRegistrationCommand the records to register,
     *  can contain new donors or existing donors but new samples.
     */
    export const createRegistration = async (command: CreateRegistrationCommand): Promise<CreateRegistrationResult> => {
        const {errors: schemaErrors} = schemaSvc.validate("registration", command.records);
        const {errors: dataErrors} = dataValidator.validateRegistrationData(command.records);
        if (schemaErrors.length > 0 || dataErrors.length > 0) {
            return {
                registrationId: undefined,
                state: undefined,
                errors: [...schemaErrors, ...dataErrors],
                successful: false
            };
        }
        const registration = await registrationDao.create(command);
        return {
            registrationId: registration.id,
            state: "uncommitted",
            errors: [],
            successful: true
        };
    };

    /**
     * TBD
     * This method will move the registered donor document to donor collection
     * and remove it from active registration collection.
     *
     * @param command CommitRegistrationCommand the id of the registration to close.
     */
    export const commitRegisteration = async (command: CommitRegistrationCommand): Promise<void> => {
        const donor: RegisterDonorDto = {
            submitterId: "DONOR1000",
            gender: "male",
            programId: "PEME-CA",
            specimens: [{
                samples: [{
                    sampleType: "RNA",
                    submitterId: "SAMP1038RNA"
                }],
                submitterId: "SPEC10999"
            }]
        };
        const created: Donor = await donorDao.register(donor);
    };

    /**
     * find registration by program Id
     * @param programId string
     */
    export const findByProgramId = async (programId: string) => {
        return await registrationDao.findByProgramId(programId);
    };
}

export interface CreateRegistrationRecord {
    programId: string;
    donorSubmitterId: string;
    gender: string;
    specimenSubmitterId: string;
    specimenType: string;
    tumorNormalDesignation: string;
    sampleSubmitterId: string;
    sampleType: string;
}

export interface CommitRegistrationCommand {
    registrationId: string;
}

export interface CreateRegistrationCommand {
    records: Array<CreateRegistrationRecord>;
    creator: string;
    programId: string;
}

export interface CreateRegistrationResult {
    registrationId: string;
    state: string;
    errors: Array<String>;
    successful: boolean;
}

export interface ValidationResult {
    errors: Array<any>;
}