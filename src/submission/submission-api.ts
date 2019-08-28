import * as submission from "./submission-service";
import * as submission2Clinical from "./submission-to-clinical";
import { Request, Response } from "express";
import { TsvUtils, ControllerUtils, isStringMatchRegex } from "../utils";
import { loggerFor } from "../logger";
import {
  CreateRegistrationCommand,
  SavedClinicalEntity,
  SubmissionMultipleCommand,
  NewClinicalEntity
} from "./submission-entities";
import { HasSubmitionAccess as HasSubmittionAccess } from "../auth-decorators";
import jwt from "jsonwebtoken";
import _ from "lodash";
const L = loggerFor(__filename);

export enum ErrorCodes {
  TSV_PARSING_FAILED = "TSV_PARSING_FAILED",
  INVALID_FILE_NAME = "INVALID_FILE_NAME",
  MULTIPLE_TYPED_FILES = "MULTIPLE_TYPED_FILES"
}
export enum FileType {
  REGISTRATION = "registration",
  DONOR = "donor",
  SPECIMEN = "specimen",
  SAMPLE = "sample"
}
export const FileNameRegex = {
  [FileType.REGISTRATION]: "^registration.*.tsv",
  [FileType.DONOR]: "^(donor).*.tsv",
  [FileType.SPECIMEN]: "^(specimen).*.tsv",
  [FileType.SAMPLE]: "^(sample).*.tsv"
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
    if (!isValidCreateBody(req, res) || !validateFile(req, res, FileType.REGISTRATION)) {
      return;
    }
    const programId = req.params.programId;
    const creator = getCreatorFromToken(req);
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
  async saveClinicalTsvFiles(req: Request, res: Response) {
    if (!isValidCreateBody(req, res)) {
      return;
    }
    const filesByTypeMap = mapFilesByType(req, res);
    if (!filesByTypeMap) {
      return;
    }
    const creator = getCreatorFromToken(req);
    const newClinicalEntities: { [k: string]: NewClinicalEntity } = {};
    for (const clinicalFileType in filesByTypeMap) {
      const fileName = filesByTypeMap[clinicalFileType].originalname;
      let records: ReadonlyArray<Readonly<{ [key: string]: string }>> = [];
      try {
        records = await TsvUtils.tsvToJson(filesByTypeMap[clinicalFileType].path);
      } catch (err) {
        return ControllerUtils.badRequest(res, {
          msg: `failed to parse the tsv file ${fileName}: ${err}`,
          code: ErrorCodes.TSV_PARSING_FAILED
        });
      }
      // add clinical entity by mapping to clinical type
      newClinicalEntities[clinicalFileType] = {
        batchName: fileName,
        creator: creator,
        records: records
      };
    }
    res.set("Content-Type", "application/json");
    const command: SubmissionMultipleCommand = {
      newClinicalEntities: newClinicalEntities,
      programId: req.params.programId
    };
    const result = await submission.operations.uploadClinicalMultiple(command);
    if (result.successful) {
      return res.status(200).send(result);
    }
    return res.status(422).send(result);
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
  return true;
};
const validateFile = (req: Request, res: Response, type: FileType) => {
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
const getCreatorFromToken = (req: Request): string => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error("can't get here without auth header");
  }
  const decoded = jwt.decode(authHeader.split(" ")[1]) as any;
  if (!decoded || !decoded.context || !decoded.context.user) {
    throw new Error("invalid token structure");
  }
  return decoded.context.user.firstName + " " + decoded.context.user.lastName;
};

// checks the files against the regex expressions and maps to a type (skips registration)
// returns an object that maps a file to a clinical type
const mapFilesByType = (req: Request, res: Response) => {
  if (req.files == undefined || req.files.length == 0) {
    ControllerUtils.badRequest(res, `Clinical file(s) upload required`);
    return;
  }
  const files = req.files as Express.Multer.File[];
  const errorList: Array<any> = [];
  const fileMap: { [k: string]: Express.Multer.File } = {};

  // check for double files and map files to clinical type
  for (const type of Object.values(FileType)) {
    if (type == FileType.REGISTRATION) {
      continue; // skip registratrion file type
    }
    const foundFiles = _.remove(files, file =>
      isStringMatchRegex(FileNameRegex[type as FileType], file.originalname)
    );
    if (foundFiles.length > 1) {
      errorList.push({
        msg: `Found multiple files of same type - [${getFileNames(foundFiles)}]`,
        code: ErrorCodes.MULTIPLE_TYPED_FILES
      });
    } else if (foundFiles.length == 1) {
      fileMap[type] = foundFiles[0];
    }
  }
  // remaning files have invalid filenames
  if (files.length > 0) {
    const filesNames = getFileNames(files);
    errorList.push({
      msg: `Invalid file(s) - [${filesNames}], must start with entity and have .tsv extension (e.g. donor*.tsv)`,
      code: ErrorCodes.INVALID_FILE_NAME
    });
  }
  // check if errors found
  if (errorList.length > 0) {
    ControllerUtils.badRequest(res, errorList);
    return;
  }
  return fileMap;
};

const getFileNames = (files: ReadonlyArray<Readonly<Express.Multer.File>>): Array<string> => {
  const names: Array<string> = [];
  files.forEach(file => names.push(file.originalname));
  return names;
};

export default new SubmissionController();
