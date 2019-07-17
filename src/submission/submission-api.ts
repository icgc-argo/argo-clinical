import * as submission from "./submission-service";
import { Request, Response } from "express";
import { TsvUtils, ControllerUtils } from "../utils";
import { loggerFor } from "../logger";
const L = loggerFor(__filename);

export const getRegistrationByProgramId = async (req: Request, res: Response) => {
  L.debug("in getRegistrationByProgramId");
  if (
    req.query == undefined ||
    req.query.programId == undefined ||
    req.query.programId.trim() == ""
  ) {
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
  let records: ReadonlyArray<Readonly<{ [key: string]: string }>>;
  try {
    records = await TsvUtils.tsvToJson(file);
  } catch (err) {
    return ControllerUtils.badRequest(res, `failed to parse the tsv file: ${err}`);
  }
  const command: submission.CreateRegistrationCommand = {
    programId: programId,
    creator: creator,
    records: records
  };

  res.set("Content-Type", "application/json");
  const result = await submission.operations.createRegistration(command);
  if (!result.successful) {
    return res.status(422).send(result);
  }
  return res.status(201).send(result);
};

export const commitRegistration = async (req: Request, res: Response) => {
  await submission.operations.commitRegisteration({
    registrationId: req.params.id
  });
  return res.status(200).send();
};

const isValidCreateBody = (req: Request, res: Response): boolean => {
  if (req.body == undefined) {
    L.debug("request body missing");
    ControllerUtils.badRequest(res, `no body`);
    return false;
  }
  if (req.body.programId == undefined) {
    L.debug("programId missing");
    ControllerUtils.badRequest(res, `programId is required`);
    return false;
  }
  if (req.body.creator == undefined) {
    L.debug("creator missing");
    ControllerUtils.badRequest(res, `creator is required`);
    return false;
  }
  if (req.file == undefined) {
    L.debug("registrationFile missing");
    ControllerUtils.badRequest(res, `registrationFile file is required`);
    return false;
  }
  return true;
};
