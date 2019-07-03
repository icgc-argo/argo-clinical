import app from "../../../app";
import * as submission from "../../../domain/submission/submission";
import { Request, Response } from "express";

export const createRegistration = async (req: Request, res: Response) => {
    const command: submission.CreateRegistrationCommand = {
        records: [{
            program_id: "PEME-CA",
            donor_submitter_id: "912387348",
            gender: "MALE",
            specimen_submitter_id: "97785",
            specimen_type: "Skin",
            tumor_normal_designation: "Primary tumor",
            sample_submitter_id: "94812",
            sample_type: "RNA"
        }]
    };
    return res.status(201).send(await submission.operations.createRegistration(command));
};

