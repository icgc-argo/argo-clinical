import { RegistrationRecord } from "./submission";

export class DataValidator {
    constructor() {
    }

    public validateRegistrationData(records: RegistrationRecord) {
        this.checkNotDuplicated();
        this.checkSpecimenDonorFK();
        this.checkSampleSpecimenFK();
    }

    private checkNotDuplicated(): boolean {
        return true;
    }

    private checkSpecimenDonorFK(): boolean {
        return this.checkFKExistsOrNew();
    }

    private checkFKExistsOrNew(): boolean {
        // 1. get donor by Id & check it does have that specimen already
        //  count(where(donors().id() == $donorId)) == 1;
        // 2. if 1 is false, check that this specimen is not associated to another donor
        // => count(where("donors().specimens().submitterId() == $FK")) == 0
        return true;
    }
    private checkSampleSpecimenFK(): boolean {
        // check that this sample is not associated to another donor specimen already
        // => count(where("donors().specimens().samples().submitterId() == $FK")) == 0
        return true;
    }
}