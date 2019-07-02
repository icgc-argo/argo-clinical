
export class SchemaService {
    constructor() {}

    public validate(fileName: string, records: Array<any>): ValidationResult {
        return {
            errors: [],
            successful: true
        };
    }
}

interface ValidationResult {
    errors: Array<any>;
    successful: boolean;
}