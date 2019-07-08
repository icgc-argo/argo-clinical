import  * as schemaSvc from "./schema";
import * as dataValidator from "./validation";
import { donorDao } from "../../adapters/clinical/repository/clinical/donor";
import { registrationRepository } from "../../adapters/clinical/repository/submission/registration";
import { Donor } from "../entities/clinical";
import { RegisterDonorDto } from "../../adapters/clinical/repository/clinical/donor";
import { ActiveRegistration, RegistrationRecord } from "../../domain/entities/submission";

export namespace operations {
    /**
     * This method creates an in progress registration after validating but doesn't create the donors in the donor collection
     * it overrides and deletes any previously uncomitted registrations.
     * @param command CreateRegistrationCommand the records to register,
     *  can contain new donors or existing donors but new samples.
     */
    export const createRegistration = async (command: CreateRegistrationCommand): Promise<CreateRegistrationResult> => {
        const schemaErrors: SchemaValidationError = schemaSvc.validate("registration", command.records);
        const registrationRecords: Array<CreateRegistrationRecord> = mapToRegistrationRecord(command);
        const {errors: dataErrors} = dataValidator.validateRegistrationData(registrationRecords);

        // if there are errors terminate the creation.
        if (anyErrors(schemaErrors, dataErrors)) {
            return {
                registrationId: undefined,
                state: undefined,
                errors: [...schemaErrors.recordsErrors, ...dataErrors],
                successful: false
            };
        }

        // build the registration object
        const registration: ActiveRegistration = toActiveRegistration(command, registrationRecords);

        // delete any existing active registration to replace it with the new one
        // we can only have 1 active registration per program
        const existingActivRegistration = await registrationRepository.findByProgramId(command.programId);
        if (existingActivRegistration != undefined) {
            await registrationRepository.delete(existingActivRegistration.id);
        }

        // save the new registration object
        const savedRegistration = await registrationRepository.create(registration);
        return {
            registrationId: savedRegistration.id,
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
        return await registrationRepository.findByProgramId(programId);
    };

    /************* Private methods *************/
    function toActiveRegistration(command: CreateRegistrationCommand, registrationRecords: CreateRegistrationRecord[]): ActiveRegistration {
        return {
            programId: command.programId,
            creator: command.creator,
            records: registrationRecords.map(r => {
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
    }

    function anyErrors(schemaErrors: SchemaValidationError, dataErrors: any[]) {
        return schemaErrors.generalErrors.length > 0 || schemaErrors.recordsErrors.length > 0 || dataErrors.length > 0;
    }

    function mapToRegistrationRecord(command: CreateRegistrationCommand): CreateRegistrationRecord[] {
        return command.records.map(r => {
            const rec: CreateRegistrationRecord = {
                programId: r.program_id,
                donorSubmitterId: r.donor_submitter_id,
                gender: r.gender,
                specimenSubmitterId: r.specimen_submitter_id,
                specimenType: r.specimen_type,
                tumorNormalDesignation: r.tumor_normal_designation,
                sampleSubmitterId: r.sample_submitter_id,
                sampleType: r.sample_type
            };
            return rec;
        });
    }
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
    // we define the records as arbitrary key value pairs to be validated by the schema
    // before we put them in a CreateRegistrationRecord, in case a column is missing so we let dictionary handle error collection.
    records: Array<{[key: string]: any}>;
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

export interface SchemaValidationError {
    generalErrors: Array<any>;
    recordsErrors: Array<any>;
}