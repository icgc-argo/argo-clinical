import  * as schemaSvc from "./schema";
import * as dataValidator from "./validation";
import { donorDao } from "../ports/dao";
import { Donor } from "../../domain/clinical/entities";
import { CreateDonorDto } from "../ports/dao";

export namespace operations {
    export const createRegistration = async (command: CreateRegistrationCommand): Promise<CreateRegistrationResult> => {
        const {errors: schemaErrors} = schemaSvc.validate("registration", command.records);
        const {errors: dataErrors} = dataValidator.validateRegistrationData(command.records);

        if (schemaErrors.length > 0 || dataErrors.length > 0) {
            return {
                registrationId: undefined,
                errors: [...schemaErrors, ...dataErrors],
                successful: false,
                donors: []
            };
        }

        const donor: CreateDonorDto = {
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

        const created: Donor = await donorDao.createDonor(donor);
        return {
            registrationId: "abcd1234",
            errors: [],
            successful: true,
            donors: [created]
        };
    };

    export const doRegisteration = (command: CreateRegistrationCommand): void => {
        // TODO: implement
    };
}

export interface CreateRegistrationCommand {
    records: Array<RegistrationRecord>;
}

export interface CreateRegistrationResult {
    registrationId: string;
    errors: Array<String>;
    successful: boolean;
    donors: Donor[];
}

export interface RegistrationRecord {
    program_id: string;
    donor_submitter_id: string;
    gender: string;
    specimen_submitter_id: string;
    specimen_type: string;
    tumor_normal_designation: string;
    sample_submitter_id: string;
    sample_type: string;
}

export interface ValidationResult {
    errors: Array<any>;
}