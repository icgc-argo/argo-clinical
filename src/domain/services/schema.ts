import { SchemaValidationError } from "./submission";

export const validate = (fileName: string, records: Array<any>): SchemaValidationError => {
    return {
        generalErrors: [],
        recordsErrors: []
    };
};
