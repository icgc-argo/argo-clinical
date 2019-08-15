import * as submission from "./submission-service";
import * as submission2Clinical from "./submission-to-clinical";
import { Request, Response } from "express";
import { TsvUtils, ControllerUtils, isStringMatchRegex } from "../utils";
import { loggerFor } from "../logger";
import { CreateRegistrationCommand } from "./submission-entities";
import { HasSubmitionAccess as HasSubmittionAccess } from "../auth-decorators";
import jwt from "jsonwebtoken";
const L = loggerFor(__filename);

export enum ErrorCodes {
  TSV_PARSING_FAILED = "TSV_PARSING_FAILED",
  INVALID_FILE_NAME = "INVALID_FILE_NAME"
}

export enum FileNameRegex {
  REGISTRATION = "registration.*.tsv",
  DONOR = "donor.*.tsv",
  SPECIMEN = "specimen.*.tsv"
}
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
    if (!isValidCreateBody(req, res)) {
      return;
    }
    const programId = req.params.programId;
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new Error("can't get here without auth header");
    }
    const decoded = jwt.decode(authHeader.split(" ")[1]) as any;
    if (!decoded) {
      throw new Error("invalid token structure");
    }
    const creator = decoded.context.user.firstName + " " + decoded.context.user.lastName;
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
    await submission2Clinical.commitRegisteration({
      registrationId: req.params.id,
      programId
    });
    return res.status(200).send();
  }

  @HasSubmittionAccess((req: Request) => req.params.programId)
  async deleteRegistration(req: Request, res: Response) {
    const programId = req.params.programId;
    const registrationId = req.params.id;
    await submission.operations.deleteRegistration(registrationId, programId);
    return res.status(200).send();
  }
}

const isValidCreateBody = (req: Request, res: Response): boolean => {
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
  if (req.file == undefined) {
    L.debug("registrationFile missing");
    ControllerUtils.badRequest(res, `registrationFile file is required`);
    return false;
  }
  if (!isStringMatchRegex(FileNameRegex.REGISTRATION, req.file.originalname)) {
    L.debug("registrationFile name is invalid");
    ControllerUtils.badRequest(res, {
      msg: `invalid file name, must be registration*.tsv`,
      code: ErrorCodes.INVALID_FILE_NAME
    });
    return false;
  }
  return true;
};

export default new SubmissionController();
