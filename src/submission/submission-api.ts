import * as submission from './submission-service';
import * as persistedConfig from './persisted-config/service';
import * as submission2Clinical from './submission-to-clinical/submission-to-clinical';
import { Request, Response } from 'express';
import { TsvUtils, ControllerUtils, Errors } from '../utils';
import { loggerFor } from '../logger';
import {
  CreateRegistrationCommand,
  MultiClinicalSubmissionCommand,
  NewClinicalEntity,
  SubmissionBatchError,
  SubmissionBatchErrorTypes,
} from './submission-entities';
import { HasFullWriteAccess, HasProgramWriteAccess } from '../decorators';
import _ from 'lodash';
import { batchErrorMessage } from './submission-error-messages';
import * as fs from 'fs';
const L = loggerFor(__filename);
const fsPromises = fs.promises;
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
    if ((await submissionSystemIsDisabled(res)) || !isValidCreateBody(req, res)) {
      return;
    }
    const programId = req.params.programId;
    const creator = ControllerUtils.getUserFromToken(req);
    const file = req.file;
    let records: ReadonlyArray<Readonly<{ [key: string]: string }>>;
    try {
      records = await TsvUtils.tsvToJson(file.path);
      if (records.length === 0) {
        throw new Error('TSV has no records!');
      }
    } catch (err) {
      L.error(`Clinical Submission TSV_PARSING_FAILED`, err);
      return ControllerUtils.invalidBatch(res, {
        message: batchErrorMessage(SubmissionBatchErrorTypes.TSV_PARSING_FAILED),
        batchNames: [file.originalname],
        code: SubmissionBatchErrorTypes.TSV_PARSING_FAILED,
      });
    }
    const command: CreateRegistrationCommand = {
      programId: programId,
      creator: creator,
      records: records,
      batchName: file.originalname,
      fieldNames: Object.keys(records[0]), // every records' mapping of fieldName<->value from a tsv should have same fieldNames/keys
    };
    const result = await submission.operations.createRegistration(command);

    if (!result.successful) {
      return res.status(422).send(result);
    }
    return res.status(201).send(result);
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async commitRegistration(req: Request, res: Response) {
    if (await submissionSystemIsDisabled(res)) return;
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
    if (await submissionSystemIsDisabled(res)) return;
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
  async uploadClinicalTsvFiles(req: Request, res: Response) {
    if ((await submissionSystemIsDisabled(res)) || !isValidCreateBody(req, res)) {
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
        if (records.length === 0) {
          throw new Error('TSV has no records!');
        }
        newClinicalData.push({
          batchName: file.originalname,
          creator: user,
          records: records,
          fieldNames: Object.keys(records[0]), // every record in a tsv should have same fieldNames
        });
      } catch (err) {
        L.error(`Clinical Submission TSV_PARSING_FAILED`, err);
        tsvParseErrors.push({
          message: batchErrorMessage(SubmissionBatchErrorTypes.TSV_PARSING_FAILED),
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

    const result = await submission.operations.submitMultiClinicalBatches(command);
    let status = 200;

    // no submission created, i.e. all uploads failed.
    if (!result.successful || tsvParseErrors.length > 0) {
      status = 207;
    }

    return res
      .status(status)
      .send({ ...result, batchErrors: [...result.batchErrors, ...tsvParseErrors] });
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async validateActiveSubmission(req: Request, res: Response) {
    if (await submissionSystemIsDisabled(res)) return;
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
    if (await submissionSystemIsDisabled(res)) return;
    const { programId, versionId, fileType } = req.params;
    const updater = ControllerUtils.getUserFromToken(req);
    L.debug(`Entering clearFileFromActiveSubmission: ${{ programId, versionId, fileType }}`);
    const updatedSubmission = await submission.operations.clearSubmissionData({
      programId,
      versionId,
      fileType,
      updater,
    });
    // Handle case where submission was cleared and is now undefined
    return res.status(200).send(updatedSubmission || {});
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async commitActiveSubmission(req: Request, res: Response) {
    if (await submissionSystemIsDisabled(res)) return;
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
    if (await submissionSystemIsDisabled(res)) return;
    const { versionId, programId } = req.params;
    await submission2Clinical.approveClinicalSubmission({
      versionId,
      programId,
    });
    return res.status(200).send();
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async reopenActiveSubmission(req: Request, res: Response) {
    if (await submissionSystemIsDisabled(res)) return;
    const { versionId, programId } = req.params;
    const updater = ControllerUtils.getUserFromToken(req);
    const activeSubmission = await submission.operations.reopenClinicalSubmission({
      versionId,
      programId,
      updater,
    });
    return res.status(200).send(activeSubmission);
  }

  @HasFullWriteAccess()
  async processLegacyIcgcData(req: Request, res: Response) {
    const clinicalFiles = req.files as { [k: string]: [Express.Multer.File] };
    const programId = req.params.programId;
    const clinicalData = {
      donors: new Array<any>(),
      specimens: new Array<any>(),
      samples: new Array<any>(),
    };

    const donorFile = clinicalFiles['donor'][0];
    const specimenFile = clinicalFiles['specimen'][0];
    const sampleFile = clinicalFiles['sample'][0];

    if (!(donorFile && specimenFile && sampleFile)) {
      return res.status(400).send('you should submit three files, donor specimen sample');
    }

    clinicalData.donors = (await TsvUtils.tsvToJson(donorFile.path)) as any;
    clinicalData.specimens = (await TsvUtils.tsvToJson(specimenFile.path)) as any;
    clinicalData.samples = (await TsvUtils.tsvToJson(sampleFile.path)) as any;

    return res.status(200).send(submission.operations.mergeIcgcLegacyData(clinicalData, programId));
  }

  @HasFullWriteAccess()
  async addDonors(req: Request, res: Response) {
    if (!req.file) {
      return res.status(400).send('need donors json file, get one by using preprocess endpoint');
    }
    const donorsJson = await fsPromises.readFile(req.file.path, 'utf-8');
    return res.status(200).send(await submission.operations.adminAddDonors(JSON.parse(donorsJson)));
  }
}

const submissionSystemIsDisabled = async (res: Response) => {
  const submissionSystemDisabled = await persistedConfig.getSubmissionDisabledState();
  if (submissionSystemDisabled) {
    L.debug(`Got submission request while submission system is disabled`);
    ControllerUtils.serviceUnavailable(res, `This submission operation is currently unavailable.`);
    return true;
  }
  return false;
};

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

export default new SubmissionController();
