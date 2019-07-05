import * as submission from "../../domain/services/submission";
import { Request, Response } from "express";
import fs from "fs";
const fsPromises = fs.promises;

export const getRegistrationByProgramId = async (req: Request, res: Response) => {
    return res.status(200).send(await submission.operations.findByProgramId(req.query.programId));
};
export const createRegistration = async (req: Request, res: Response) => {
    const { programId, creator } = req.body;
    const command: submission.CreateRegistrationCommand = {
        programId,
        creator,
        records : await tsvToJson(req.file)
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

const tsvToJson = async (file: Express.Multer.File): Promise<Array<{[key: string]: any}>> => {
    const contents = await fsPromises.readFile(file.path, "utf-8");
    return parseTsvToJson(contents);
};

const parseTsvToJson = (content: string) => {
    const lines = content.split("\n");
    const headers = lines.slice(0, 1)[0].split("\t");
    const rows = lines.slice(1, lines.length).map(line => {
        if (line.trim() === "") {
            return undefined;
        }
        const data = line.split("\t");
        return headers.reduce<{[k: string]: string}>((obj, nextKey, index) => {
        obj[nextKey] = data[index];
        return obj;
        }, {});
    });
    return rows.filter((el) => el != undefined);
};