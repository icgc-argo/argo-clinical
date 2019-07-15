import fs from "fs";
import { Request, Response } from "express";
const fsPromises = fs.promises;

export namespace TsvUtils {
    export const tsvToJson = async (file: Express.Multer.File): Promise<Array<{[key: string]: any}>> => {
        const contents = await fsPromises.readFile(file.path, "utf-8");
        return parseTsvToJson(contents);
    };

    export const parseTsvToJson = (content: string) => {
        const lines = content.split("\n");
        const headers = lines.slice(0, 1)[0].split("\t");
        const rows = lines.slice(1, lines.length).map(line => {
            // check for any empty lines
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
}

export namespace ControllerUtils {
    export const notFound = (res: Response, msg: string): any => {
        res.status(404).send({message: msg});
    };

    export const badRequest = (res: Response, msg: string): any => {
        res.status(400).send({message: msg});
    };
}