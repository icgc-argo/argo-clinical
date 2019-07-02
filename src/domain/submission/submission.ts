import { SchemaService } from "./schema";

export class SubmissionManager {
    constructor(private schemaSvc: SchemaService) {
        this.schemaSvc = new SchemaService();
    }

    public createRegistration(command: CreateRegistrationCommand): CreateRegistrationResult {
        const result = this.schemaSvc.validate("registration", command.records);
        if (result.errors.length > 0) {
            return {
                registrationId: undefined,
                errors: [],
                successful: false
            };
        }

        return {
            registrationId: "abcd1234",
            errors: [],
            successful: true
        };
    }

    public doRegisteration(command: CreateRegistrationCommand): void {
        // TODO: implement
    }
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

interface CreateRegistrationCommand {
    records: Array<RegistrationRecord>;
}

interface CreateRegistrationResult {
    registrationId: string;
    errors: Array<String>;
    successful: boolean;
}