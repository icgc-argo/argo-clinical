import * as submission from "../../domain/services/submission";
import { Request, Response } from "express";
import { TsvUtils, ControllerUtils } from "../utils";

export const getRegistrationByProgramId = async (req: Request, res: Response) => {
    if (req.query == undefined || req.query.programId == undefined || req.query.programId.trim() == "") {
        return ControllerUtils.badRequest(res, `programId query param missing`);
    }
    const programId = req.query.programId;
    const registration = await submission.operations.findByProgramId(programId);
    if (registration == undefined) {
        return ControllerUtils.notFound(res, `no active registration for this program '${programId}'`);
    }
    return res.status(200).send(registration);
};

export const createRegistrationWithTsv = async (req: Request, res: Response) => {
    if (!isValidCreateBody(req, res)) {
        return;
    }
    const { programId, creator } = req.body;
    const file = req.file;
    let records = [];
    try {
        records = await TsvUtils.tsvToJson(file);
    } catch (err) {
        return ControllerUtils.badRequest(res, `failed to parse the tsv file: ${err}`);
    }
    const command: submission.CreateRegistrationCommand = {
        programId,
        creator,
        records : records
    };
    res.set("Content-Type", "application/json");
    return res.status(201).send(await submission.operations.createRegistration(command));
};

export const commitRegistration = async (req: Request, res: Response) => {
    await submission.operations.commitRegisteration({
        registrationId: req.params.id
    });
    return res.status(200).send();
};

const isValidCreateBody = (req: Request, res: Response): boolean => {
    if (req.body == undefined) {
        ControllerUtils.badRequest(res, `no body`);
        return false;
    }
    if (req.body.programId == undefined) {
        ControllerUtils.badRequest(res, `programId is required`);
        return false;
    }
    if (req.body.creator == undefined) {
        ControllerUtils.badRequest(res, `creator is required`);
        return false;
    }
    if (req.file == undefined) {
        ControllerUtils.badRequest(res, `registrationFile file is required`);
        return false;
    }
    return true;
};
