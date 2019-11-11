import * as submission from './submission-service';
import * as submission2Clinical from './submission-to-clinical';
import { Request, Response } from 'express';
import { TsvUtils, ControllerUtils, isStringMatchRegex } from '../utils';
import { loggerFor } from '../logger';
import {
  CreateRegistrationCommand,
  MultiClinicalSubmissionCommand,
  NewClinicalEntity,
  SubmissionBatchError,
  SubmissionBatchErrorTypes,
  ClinicalEntityType,
  BatchNameRegex,
} from './submission-entities';
import { HasFullWriteAccess, HasProgramWriteAccess } from '../auth-decorators';
import jwt from 'jsonwebtoken';
import _ from 'lodash';
const L = loggerFor(__filename);

class SubmissionController {
  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async getRegistrationByProgramId(req: Request, res: Response) {
    L.debug('in getRegistrationByProgramId');
    const programId = req.params.programId;
    const registration = await submission.operations.findByProgramId(programId);
    if (registration == undefined) {
      return res.status(200).send({});
    }
    return res.status(200).send(registration);
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async createRegistrationWithTsv(req: Request, res: Response) {
    if (!isValidCreateBody(req, res)) {
      return;
    }
    const programId = req.params.programId;
    const creator = ControllerUtils.getUserFromToken(req);
    const file = req.file;
    let records: ReadonlyArray<Readonly<{ [key: string]: string }>>;
    try {
      records = await TsvUtils.tsvToJson(file.path);
    } catch (err) {
      return ControllerUtils.badRequest(res, {
        msg: `failed to parse the tsv file: ${err}`,
        code: SubmissionBatchErrorTypes.TSV_PARSING_FAILED,
      });
    }
    const command: CreateRegistrationCommand = {
      programId: programId,
      creator: creator,
      records: records,
      batchName: file.originalname,
      fieldNames: Object.keys(records[0]), // every record in a tsv should have same fieldNames
    };
    const result = await submission.operations.createRegistration(command);

    if (result.successful) {
      return res.status(201).send(result);
    } else if (result.batchErrors) {
      return res.status(400).send(result);
    } else if (result.errors) {
      return res.status(422).send(result);
    }
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async commitRegistration(req: Request, res: Response) {
    const programId = req.params.programId;
    const newSamples: string[] = await submission2Clinical.commitRegisteration({
      registrationId: req.params.id,
      programId,
    });
    return res.status(200).send({
      newSamples,
    });
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async deleteRegistration(req: Request, res: Response) {
    const programId = req.params.programId;
    const registrationId = req.params.id;
    await submission.operations.deleteRegistration(registrationId, programId);
    return res.status(200).send();
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async getActiveSubmissionByProgramId(req: Request, res: Response) {
    const programId = req.params.programId;
    const activeSubmission = await submission.operations.findSubmissionByProgramId(programId);
    if (activeSubmission === undefined) {
      return res.status(200).send({});
    }
    return res.status(200).send(activeSubmission);
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async saveClinicalTsvFiles(req: Request, res: Response) {
    if (!isValidCreateBody(req, res)) {
      return;
    }

    const user = ControllerUtils.getUserFromToken(req);
    const newClinicalData: NewClinicalEntity[] = [];
    const tsvParseErrors: SubmissionBatchError[] = [];
    const clinicalFiles = req.files as Express.Multer.File[];
    for (const file of clinicalFiles) {
      try {
        // check if has .tsv extension to prevent irregular file names from reaching service level
        if (!file.originalname.match(/.*\.tsv$/)) {
          throw new Error('invalid extension');
        }
        let records: ReadonlyArray<Readonly<{ [fieldName: string]: string }>> = [];
        records = await TsvUtils.tsvToJson(file.path);
        newClinicalData.push({
          batchName: file.originalname,
          creator: user,
          records: records,
          fieldNames: Object.keys(records[0]), // every record in a tsv should have same fieldNames
        });
      } catch (err) {
        tsvParseErrors.push({
          msg: `failed to parse the tsv file: ${err}`,
          batchNames: [file.originalname],
          code: SubmissionBatchErrorTypes.TSV_PARSING_FAILED,
        });
      }
    }
    const command: MultiClinicalSubmissionCommand = {
      newClinicalData: newClinicalData,
      programId: req.params.programId,
      updater: user,
    };
    const result = await submission.operations.uploadMultipleClinical(command);
    let status = 200;
    if (!result.successful) {
      status = 422;
    } else if (tsvParseErrors.length > 0 || result.batchErrors.length > 0) {
      status = 207;
    }
    return res
      .status(status)
      .send({ ...result, batchErrors: [...result.batchErrors, ...tsvParseErrors] });
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async validateActiveSubmission(req: Request, res: Response) {
    const { versionId, programId } = req.params;
    const updater = ControllerUtils.getUserFromToken(req);
    const result = await submission.operations.validateMultipleClinical({
      versionId,
      programId,
      updater,
    });
    if (result.successful) {
      return res.status(200).send(result);
    }
    return res.status(422).send(result);
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async clearFileFromActiveSubmission(req: Request, res: Response) {
    const { programId, versionId, fileType } = req.params;
    const updater = ControllerUtils.getUserFromToken(req);
    L.debug(`Entering clearFileFromActiveSubmission: ${{ programId, versionId, fileType }}`);
    const updatedSubmission = await submission.operations.clearSubmissionData({
      programId,
      versionId,
      fileType,
      updater,
    });
    return res.status(200).send(updatedSubmission);
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async commitActiveSubmission(req: Request, res: Response) {
    const { versionId, programId } = req.params;
    const updater = ControllerUtils.getUserFromToken(req);
    const activeSubmission = await submission2Clinical.commitClinicalSubmission({
      versionId,
      programId,
      updater,
    });
    return res.status(200).send(activeSubmission);
  }

  @HasFullWriteAccess()
  async approveActiveSubmission(req: Request, res: Response) {
    const { versionId, programId } = req.params;
    await submission2Clinical.approveClinicalSubmission({
      versionId,
      programId,
    });
    return res.status(200).send();
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async reopenActiveSubmission(req: Request, res: Response) {
    const { versionId, programId } = req.params;
    const updater = ControllerUtils.getUserFromToken(req);
    const activeSubmission = await submission.operations.reopenClinicalSubmission({
      versionId,
      programId,
      updater,
    });
    return res.status(200).send(activeSubmission);
  }
}

const isValidCreateBody = (req: Request, res: Response): boolean => {
  if (req.body === undefined) {
    L.debug('request body missing');
    ControllerUtils.badRequest(res, `no body`);
    return false;
  }
  if (req.params.programId === undefined) {
    L.debug('programId missing');
    ControllerUtils.badRequest(res, `programId is required`);
    return false;
  }
  if (req.file === undefined && (req.files === undefined || req.files.length === 0)) {
    L.debug(`File(s) missing`);
    ControllerUtils.badRequest(res, `Clinical file(s) upload required`);
    return false;
  }
  return true;
};
const validateRegistrationFile = (req: Request, res: Response) => {
  if (!isStringMatchRegex(BatchNameRegex[ClinicalEntityType.REGISTRATION], req.file.originalname)) {
    L.debug(`${ClinicalEntityType.REGISTRATION}File name is invalid`);
    ControllerUtils.badRequest(res, {
      msg: `invalid file name, must start with ${ClinicalEntityType.REGISTRATION} and have .tsv extension`,
      code: SubmissionBatchErrorTypes.INVALID_FILE_NAME,
    });
    return false;
  }
  return true;
};

export default new SubmissionController();
