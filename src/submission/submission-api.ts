/*
 * Copyright (c) 2023 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

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
  LegacyICGCImportRecord,
} from './submission-entities';
import { HasFullWriteAccess, HasProgramWriteAccess } from '../decorators';
import _ from 'lodash';
import { batchErrorMessage } from './submission-error-messages';
import * as fs from 'fs';
import { GlobalGqlContext } from '../app';

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

  async getRegistrationDataByProgramId(programId: string) {
    L.debug('in getRegistrationByProgramId');
    const registration = await submission.operations.findByProgramId(programId);
    return registration;
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async createRegistrationWithTsv(req: Request, res: Response) {
    if ((await submissionSystemIsDisabled(res)) || !isValidCreateBody(req, res)) {
      return;
    }
    const programId = req.params.programId;
    const creator = ControllerUtils.getUserFromRequest(req);
    const file = req.file;
    let records: ReadonlyArray<TsvUtils.TsvRecordAsJsonObj>;
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
    const newSamples: string[] = await submission2Clinical.commitRegistration({
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

  async getActiveSubmissionDataByProgramId(programId: string) {
    const activeSubmission = await submission.operations.findSubmissionByProgramId(programId);
    return activeSubmission;
  }

  // @HasProgramWriteAccess((req: Request) => req.params.programId)
  async uploadClinicalDataFromTsvFiles(programId: string, uploadedFiles: {}, token: string) {
    const submissionSystemDisabled = await persistedConfig.getSubmissionDisabledState();
    if (submissionSystemDisabled || !isValidRequestArgs(programId, uploadedFiles)) return;

    const user = ControllerUtils.getUserFromToken(token);
    const newClinicalData: NewClinicalEntity[] = [];
    const tsvParseErrors: SubmissionBatchError[] = [];
    const clinicalFiles = uploadedFiles as Express.Multer.File[];

    for (const file of clinicalFiles) {
      try {
        // check if it has .tsv extension to prevent irregular file names from reaching service level
        if (!file.originalname.match(/.*\.tsv$/)) {
          throw new Error('invalid extension');
        }
        let records: ReadonlyArray<TsvUtils.TsvRecordAsJsonObj> = [];
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
      programId, // req.params.programId,
      updater: user,
    };

    const result = await submission.operations.submitMultiClinicalBatches(command);
    return { ...result, batchErrors: [...result.batchErrors, ...tsvParseErrors] };
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async uploadClinicalTsvFiles(req: Request, res: Response) {
    if ((await submissionSystemIsDisabled(res)) || !isValidCreateBody(req, res)) {
      return;
    }

    const user = ControllerUtils.getUserFromRequest(req);
    const newClinicalData: NewClinicalEntity[] = [];
    const tsvParseErrors: SubmissionBatchError[] = [];
    const clinicalFiles = req.files as Express.Multer.File[];

    for (const file of clinicalFiles) {
      try {
        // check if has .tsv extension to prevent irregular file names from reaching service level
        if (!file.originalname.match(/.*\.tsv$/)) {
          throw new Error('invalid extension');
        }
        let records: ReadonlyArray<TsvUtils.TsvRecordAsJsonObj> = [];
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
    const updater = ControllerUtils.getUserFromRequest(req);
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

  // @HasProgramWriteAccess((req: Request) => req.params.programId)
  async validateActiveSubmissionData(programId: string, versionId: string, token: string) {
    const submissionSystemDisabled = await persistedConfig.getSubmissionDisabledState();
    if (submissionSystemDisabled) return;
    const updater = ControllerUtils.getUserFromToken(token);
    const validatedSubmission = await submission.operations.validateMultipleClinical({
      versionId,
      programId,
      updater,
    });
    return validatedSubmission;
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async clearFileFromActiveSubmission(req: Request, res: Response) {
    if (await submissionSystemIsDisabled(res)) return;
    const { programId, versionId, fileType } = req.params;
    const updater = ControllerUtils.getUserFromRequest(req);
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

  // @HasProgramWriteAccess((programId: string) => programId)
  async clearFileDataFromActiveSubmission(
    programId: string,
    fileType: string,
    versionId: string,
    token: string,
  ) {
    const submissionSystemDisabled = await persistedConfig.getSubmissionDisabledState();
    if (submissionSystemDisabled) return;
    const updater = ControllerUtils.getUserFromToken(token);
    L.debug(`Entering clearFileDataFromActiveSubmission: ${{ programId, versionId, fileType }}`);
    const updatedSubmission = await submission.operations.clearSubmissionData({
      programId,
      versionId,
      fileType,
      updater,
    });
    // Handle case where submission was cleared and is now undefined
    return updatedSubmission;
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async commitActiveSubmission(req: Request, res: Response) {
    if (await submissionSystemIsDisabled(res)) return;
    const { versionId, programId } = req.params;
    const updater = ControllerUtils.getUserFromRequest(req);
    const activeSubmission = await submission2Clinical.commitClinicalSubmission({
      versionId,
      programId,
      updater,
    });
    return res.status(200).send(activeSubmission);
  }

  // @HasProgramWriteAccess((req: Request) => req.params.programId)
  async commitActiveSubmissionData(programId: string, versionId: string, token: string) {
    const submissionSystemDisabled = await persistedConfig.getSubmissionDisabledState();
    if (submissionSystemDisabled) return;
    const updater = ControllerUtils.getUserFromToken(token);
    const activeSubmission = await submission2Clinical.commitClinicalSubmission({
      versionId,
      programId,
      updater,
    });
    return activeSubmission;
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
    const updater = ControllerUtils.getUserFromRequest(req);
    const activeSubmission = await submission.operations.reopenClinicalSubmission({
      versionId,
      programId,
      updater,
    });
    return res.status(200).send(activeSubmission);
  }

  @HasFullWriteAccess()
  async processLegacyIcgcData(req: Request, res: Response) {
    const samplesFile = req.file;
    const programId = req.params.programId as string;

    if (!programId) {
      return res.status(400).send('Program id must be provided');
    }

    if (!samplesFile) {
      return res
        .status(400)
        .send(
          'you should submit a TSV sample file containing these headers: [project_code, submitted_donor_id' +
            'icgc_donor_id, donor_sex, submitted_specimen_id, specimen_type, icgc_specimen_id, icgc_sample_id, submitted_sample_id, library_strategy] ',
        );
    }

    const samples = (await TsvUtils.tsvToJson(samplesFile.path)) as Readonly<
      LegacyICGCImportRecord
    >[];
    return res
      .status(200)
      .send(submission.operations.mergeIcgcLegacyData(samples, programId.toUpperCase()));
  }

  @HasFullWriteAccess()
  async addDonors(req: Request, res: Response) {
    if (!req.file) {
      return res.status(400).send('need donors json file, get one by using preprocess endpoint');
    }
    const donorsJson = await fsPromises.readFile(req.file.path, 'utf-8');
    return res
      .status(201)
      .send(await submission.operations.importLegacyDonors(JSON.parse(donorsJson)));
  }

  @HasFullWriteAccess()
  async deleteRegisteredSamples(req: Request, res: Response) {
    const programId = req.params.programId as string;
    const samplesSubmitterIds =
      req.query.sampleSubmitterIds && req.query.sampleSubmitterIds.split(',');
    const dryRun = req.query.dryRun === 'false' ? false : true;
    const updater = ControllerUtils.getUserFromRequest(req);
    L.info(
      `Delete registered samples called, caller ${updater}, ids: ${samplesSubmitterIds}, programId: ${programId}`,
    );
    return res
      .status(200)
      .send(await submission.operations.adminDeleteSamples(programId, samplesSubmitterIds, dryRun));
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
