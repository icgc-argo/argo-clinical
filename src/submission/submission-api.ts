import * as submission from "./submission-service";
import * as submission2Clinical from "./submission-to-clinical";
import { Request, Response } from "express";
import { TsvUtils, ControllerUtils, isStringMatchRegex, Errors } from "../utils";
import { loggerFor } from "../logger";
import {
  CreateRegistrationCommand,
  ClinicalEntity,
  SaveClinicalCommand2
} from "./submission-entities";
import { HasSubmitionAccess as HasSubmittionAccess } from "../auth-decorators";
import jwt from "jsonwebtoken";
const L = loggerFor(__filename);

export enum ErrorCodes {
  TSV_PARSING_FAILED = "TSV_PARSING_FAILED",
  INVALID_FILE_NAME = "INVALID_FILE_NAME"
}
export enum FileType {
  REGISTRATION = "registration",
  DONOR = "donor",
  SPECIMEN = "specimen",
  SAMPLE = "sample"
}
export const FileNameRegex = {
  [FileType.REGISTRATION]: "registration.*.tsv",
  [FileType.DONOR]: "(donor).*.tsv",
  [FileType.SPECIMEN]: "(specimen).*.tsv",
  [FileType.SAMPLE]: "(sample).*.tsv"
};
class SubmissionController {
  @HasSubmittionAccess((req: Request) => req.params.programId)
  async getRegistrationByProgramId(req: Request, res: Response) {
    L.debug("in getRegistrationByProgramId");
    const programId = req.params.programId;
    const registration = await submission.operations.findByProgramId(programId);
    if (registration == undefined) {
      return res.status(200).send({});
    }
    return res.status(200).send(registration);
  }

  @HasSubmittionAccess((req: Request) => req.params.programId)
  async createRegistrationWithTsv(req: Request, res: Response) {
    if (!isValidCreateBody(req, res, FileType.REGISTRATION)) {
      return;
    }
    const programId = req.params.programId;
    const creator = checkAuthReCreator(req);
    const file = req.file;
    let records: ReadonlyArray<Readonly<{ [key: string]: string }>>;
    try {
      records = await TsvUtils.tsvToJson(file.path);
    } catch (err) {
      return ControllerUtils.badRequest(res, {
        msg: `failed to parse the tsv file: ${err}`,
        code: ErrorCodes.TSV_PARSING_FAILED
      });
    }
    const command: CreateRegistrationCommand = {
      programId: programId,
      creator: creator,
      records: records,
      batchName: file.originalname
    };
    res.set("Content-Type", "application/json");
    const result = await submission.operations.createRegistration(command);
    if (!result.successful) {
      return res.status(422).send(result);
    }
    return res.status(201).send(result);
  }

  @HasSubmittionAccess((req: Request) => req.params.programId)
  async commitRegistration(req: Request, res: Response) {
    const programId = req.params.programId;
    const newSamples: string[] = await submission2Clinical.commitRegisteration({
      registrationId: req.params.id,
      programId
    });
    return res.status(200).send({
      newSamples
    });
  }

  @HasSubmittionAccess((req: Request) => req.params.programId)
  async deleteRegistration(req: Request, res: Response) {
    const programId = req.params.programId;
    const registrationId = req.params.id;
    await submission.operations.deleteRegistration(registrationId, programId);
    return res.status(200).send();
  }

  @HasSubmittionAccess((req: Request) => req.params.programId)
  async saveClinicalTsvFile(req: Request, res: Response) {
    // checkFiles(req, res);
    const creator = checkAuthReCreator(req);
    const files = req.files as Express.Multer.File[];
    const clinicalEntities: { [k: string]: ClinicalEntity } = {};
    for (const file of files) {
      let clinType: string = "";
      for (const exp in FileNameRegex) {
        const match = file.originalname.match(exp);
        if (match) {
          clinType = match[0];
          break;
        }
      }
      // common code move to function?
      let records: ReadonlyArray<Readonly<{ [key: string]: string }>> = [];
      try {
        records = await TsvUtils.tsvToJson(file.path);
      } catch (err) {
        return ControllerUtils.badRequest(res, {
          msg: `failed to parse the tsv file: ${err}`,
          code: ErrorCodes.TSV_PARSING_FAILED
        });
      }
      clinicalEntities[clinType] = {
        batchName: file.originalname,
        creator: creator,
        records: records,
        dataErrors: [],
        stats: {
          new: [],
          noUpdate: [],
          updated: [],
          errorsFound: []
        }
      };
    }
    res.set("Content-Type", "application/json");
    const command: SaveClinicalCommand2 = {
      clinicalEntities: clinicalEntities,
      programId: req.params.programId
    };
    const result = await submission.operations.uploadClinicalMultiple(command);
    if (result.successful) return res.status(200).send(result);
    return res.status(422).send(result);
  }
}

const isValidCreateBody = (req: Request, res: Response, type: FileType): boolean => {
  if (req.body == undefined) {
    L.debug("request body missing");
    ControllerUtils.badRequest(res, `no body`);
    return false;
  }
  if (req.params.programId == undefined) {
    L.debug("programId missing");
    ControllerUtils.badRequest(res, `programId is required`);
    return false;
  }
  if (!Object.values(FileType).includes(type)) {
    ControllerUtils.badRequest(res, `invalid clinical submission type ${type}`);
    return false;
  }
  if (req.file == undefined) {
    L.debug(`${type}File missing`);
    ControllerUtils.badRequest(res, `${type}File file is required`);
    return false;
  }
  if (!isStringMatchRegex(FileNameRegex[type], req.file.originalname)) {
    L.debug(`${type}File name is invalid`);
    ControllerUtils.badRequest(res, {
      msg: `invalid file name, must start with ${type} and have .tsv extension`,
      code: ErrorCodes.INVALID_FILE_NAME
    });
    return false;
  }
  return true;
};

// checks authHeader + decoded jwt and returns the creator
const checkAuthReCreator = (req: Request): string => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error("can't get here without auth header");
  }
  const decoded = jwt.decode(authHeader.split(" ")[1]) as any;
  if (!decoded) {
    throw new Error("invalid token structure");
  }
  return decoded.context.user.firstName + " " + decoded.context.user.lastName;
};

// todo Refactor, also check for duplicate entities
const checkFiles = (req: Request, res: Response) => {
  console.log("Files are: " + req.files);
  const files = req.files as Express.Multer.File[];

  if (files == undefined) {
    L.debug(`File(s) missing`);
    ControllerUtils.badRequest(res, `Clinical file(s) upload required`);
    return false;
  }
  const errorList: Array<any> = [];
  files.forEach(file => {
    let found: boolean = false;
    for (const exp in FileNameRegex) {
      if (isStringMatchRegex(exp, file.originalname)) {
        found = true;
      }
    }
    if (!found) {
      L.debug(`File name is invalid - ${file.originalname}`);
      errorList.push({
        msg: `invalid file name ${file.originalname}, must start with entity and have .tsv extension (e.g. donor*.tsv)`,
        code: ErrorCodes.INVALID_FILE_NAME
      });
    }
  });
  if (errorList.length > 0) {
    ControllerUtils.badRequest(res, errorList);
  }
  return true;
};

export default new SubmissionController();
