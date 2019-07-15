import { CreateRegistrationRecord, ValidationResult } from "./submission";

export const validateRegistrationData = (records: Array<CreateRegistrationRecord>): ValidationResult => {
    checkNotDuplicated();
    checkSpecimenDonorFK();
    checkSampleSpecimenFK();
    return {
        errors: []
    };
};

const checkNotDuplicated = (): boolean => {
    return true;
};

const checkSpecimenDonorFK = (): boolean => {
    return checkFKExistsOrNew();
};

const checkFKExistsOrNew = (): boolean => {
    // 1. get donor by Id & check it does have that specimen already
    //  count(where(donors().id() == $donorId)) == 1;
    // 2. if 1 is false, check that this specimen is not associated to another donor
    // => count(where("donors().specimens().submitterId() == $FK")) == 0
      return true;
};

const checkSampleSpecimenFK = (): boolean => {
    // check that this sample is not associated to another donor specimen already
    // => count(where("donors().specimens().samples().submitterId() == $FK")) == 0
    return true;
};