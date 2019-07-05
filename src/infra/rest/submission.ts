import * as submission from "../../domain/services/submission";
import { Request, Response } from "express";


export const getRegistrationByProgramId = async (req: Request, res: Response) => {
    return res.status(200).send(await submission.operations.findByProgramId(req.query.programId));
};
export const createRegistration = async (req: Request, res: Response) => {
    const { programId, creator } = req.body;
    const command: submission.CreateRegistrationCommand = {
        programId,
        creator,
        records : tsvToJson(req.file)
    };
    return res.status(201).send(await submission.operations.createRegistration(command));
};

export const commitRegistration = async (req: Request, res: Response) => {
    await submission.operations.commitRegisteration({
        registrationId: req.params.id
    });
    return res.status(200).send();
};

const tsvToJson = (file: Express.Multer.File): Array<{[key: string]: any}> => {
    return [
        {
            program_id: "PEME-CA",
        }
    ];
};