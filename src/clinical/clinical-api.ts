/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
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

import { Request, Response } from 'express';
import * as service from './clinical-service';
import {
  HasFullWriteAccess,
  ProtectTestEndpoint,
  HasProgramReadAccess,
  HasFullReadAccess,
} from '../decorators';
import { EntityAlias } from '../common-model/entities';
import { ControllerUtils, DonorUtils, TsvUtils } from '../utils';
import AdmZip from 'adm-zip';
import { Donor } from './clinical-entities';
import { omit } from 'lodash';
import { DeepReadonly } from 'deep-freeze';

export type ClinicalQuery = {
  programShortName: string;
  page: number;
  pageSize: number;
  entityTypes: EntityAlias[];
  sort: string;
  donorIds: string[];
  submitterDonorIds: string[];
  completionState?: {};
  useFilteredDonors?: boolean;
};

enum CompletionStates {
  all = 'all',
  invalid = 'invalid',
  complete = 'complete',
  incomplete = 'incomplete',
}

const completionFilters = {
  invalid: { 'schemaMetadata.isValid': false },
  complete: { 'completionStats.coreCompletionPercentage': 1 },
  incomplete: { 'completionStats.coreCompletionPercentage': { $lt: 1 } },
  all: {},
};

class ClinicalController {
  @HasFullReadAccess()
  async findDonors(req: Request, res: Response) {
    return res.status(200).send(await service.getDonors(req.query.programId));
  }

  @HasProgramReadAccess((req: Request) => req.params.programId)
  async getProgramClinicalDataAsTsvsInZip(req: Request, res: Response) {
    const programId = req.params.programId;
    if (!programId) {
      return ControllerUtils.badRequest(res, 'Invalid programId provided');
    }

    const data = await service.getClinicalData(programId);

    const todaysDate = currentDateFormatted();
    res
      .status(200)
      .contentType('application/zip')
      .attachment(`${programId}_Clinical_Data_${todaysDate}.zip`);

    const zip = new AdmZip();
    data.forEach((d: any) => {
      const tsvData = TsvUtils.convertJsonRecordsToTsv(d.records, d.entityFields);
      zip.addFile(`${d.entityName}.tsv`, Buffer.alloc(tsvData.length, tsvData));
    });

    res.send(zip.toBuffer());
  }

  @HasProgramReadAccess((req: Request) => req.params.programId)
  async getProgramClinicalEntityData(req: Request, res: Response) {
    const programId: string = req.params.programId;
    const sort: string = req.query.sort || 'donorId';
    const page: number = parseInt(req.query.page);
    const state: CompletionStates = req.query.completionState || CompletionStates.all;
    const entityTypes: string[] =
      req.query.entityTypes && req.query.entityTypes.length > 0
        ? req.query.entityTypes.split(',')
        : [''];
    const completionState: {} = completionFilters[state] || {};
    // FE filters digits out of search text for Donor search
    const donorIds = req.query.donorIds.match(/\d*/gi)?.filter((match: string) => !!match) || [];
    const submitterDonorIds =
      req.query.submitterDonorIds && req.query.submitterDonorIds.length > 0
        ? req.query.submitterDonorIds.split(',').filter((match: string) => !!match)
        : '';

    const useFilteredDonors =
      (donorIds && donorIds.length) || (submitterDonorIds && submitterDonorIds.length);

    const query: ClinicalQuery = {
      ...req.query,
      sort,
      entityTypes,
      page,
      donorIds,
      submitterDonorIds,
      completionState,
      useFilteredDonors,
    };

    if (!programId) {
      return ControllerUtils.badRequest(res, 'Invalid programId provided');
    }

    const entityData = await service.getPaginatedClinicalData(programId, query);

    res.status(200).json(entityData);
  }

  @HasProgramReadAccess((req: Request) => req.params.programId)
  async getProgramClinicalSearchResults(req: Request, res: Response) {
    const programId: string = req.params.programId;
    const sort: string = req.query.sort || 'donorId';
    const page: number = parseInt(req.query.page);
    const state: CompletionStates = req.query.completionState || CompletionStates.all;
    const entityTypes: string[] =
      req.query.entityTypes && req.query.entityTypes.length > 0
        ? req.query.entityTypes.split(',')
        : [''];
    const completionState: {} = completionFilters[state] || {};
    // FE filters digits out of search text for Donor search
    const donorIds = req.query.donorIds.match(/\d*/gi)?.filter((match: string) => !!match) || [];
    const submitterDonorIds =
      req.query.submitterDonorIds && req.query.submitterDonorIds.length > 0
        ? req.query.submitterDonorIds.split(',').filter((match: string) => !!match)
        : '';

    const useFilteredDonors =
      (donorIds && donorIds.length) || (submitterDonorIds && submitterDonorIds.length);

    const query: ClinicalQuery = {
      ...req.query,
      sort,
      entityTypes,
      page,
      donorIds,
      submitterDonorIds,
      completionState,
      useFilteredDonors,
    };

    if (!programId) {
      return ControllerUtils.badRequest(res, 'Invalid programId provided');
    }

    const entityData = await service.getPaginatedClinicalData(programId, query);

    res.status(200).json(entityData);
  }

  @HasProgramReadAccess((req: Request) => req.params.programId)
  async getProgramClinicalErrors(req: Request, res: Response) {
    const programId = req.params.programId;
    const query = req.query.donorIds && req.query.donorIds.split(',');
    if (!programId) {
      return ControllerUtils.badRequest(res, 'Invalid programId provided');
    }

    const clinicalErrors = await service.getClinicalEntityMigrationErrors(programId, query);

    res.status(200).json(clinicalErrors);
  }

  /**
   * Fetches data for a single clinical entity type and returns the values as a TSV. This is returned in the body of the request, not as a downloadable file.
   * @param req
   * @param res
   * @returns
   */
  @HasProgramReadAccess((req: Request) => req.params.programId)
  async getProgramClinicalDataAsTsv(req: Request, res: Response) {
    const programId = req.params.programId as string;
    const entityType = req.params.entityType as string;
    if (!programId) {
      return ControllerUtils.badRequest(res, 'Invalid programId provided');
    }

    const allData = await service.getClinicalData(programId);

    const entityData = allData.find(
      (entity: { entityName: string } & any) => entity.entityName === entityType,
    );

    if (!entityData) {
      return res.status(400).send('No data for the requested entity type');
    }

    res
      .status(200)
      .contentType('text/tab-separated-values')
      .send(TsvUtils.convertJsonRecordsToTsv(entityData.records, entityData.entityFields));
  }

  @ProtectTestEndpoint()
  @HasFullWriteAccess()
  async deleteDonors(req: Request, res: Response) {
    return res.status(200).send(await service.deleteDonors(req.query.programId));
  }

  async findDonorId(req: Request, res: Response) {
    const id = await service.findDonorId(req.query.submitterId, req.query.programId);
    return res
      .contentType('text/plain')
      .status(200)
      .send(id);
  }

  async findSpecimenId(req: Request, res: Response) {
    const id = await service.findSpecimenId(req.query.submitterId, req.query.programId);
    return res
      .contentType('text/plain')
      .status(200)
      .send(id);
  }

  async findSampleId(req: Request, res: Response) {
    const id = await service.findSampleId(req.query.submitterId, req.query.programId);
    return res
      .contentType('text/plain')
      .status(200)
      .send(id);
  }

  @HasFullWriteAccess()
  async patchDonorCompletionStats(req: Request, res: Response) {
    const donorId = DonorUtils.parseDonorId(req.params.donorId);

    if (!donorId) {
      return ControllerUtils.badRequest(res, 'Invalid/Missing donorId, e.g. DO123');
    }

    const coreCompletionOverride = req.body.coreCompletionOverride || {};

    const updatedDonor = await service.updateDonorStats(donorId, coreCompletionOverride);

    if (!updatedDonor) {
      return ControllerUtils.notFound(res, `Donor with donorId:${donorId} not found`);
    }

    return res.status(200).send(updatedDonor);
  }

  @HasProgramReadAccess((req: Request) => req.params.programId)
  async getDonorById(req: Request, res: Response) {
    const programId = req.params.programId;
    if (!programId) {
      return ControllerUtils.badRequest(res, 'Invalid/Missing programId, e.g. ABCD-CA');
    }
    const donorId = DonorUtils.parseDonorId(req.params.donorId);
    if (!donorId) {
      return ControllerUtils.badRequest(res, 'Invalid/Missing donorId, e.g. DO123');
    }
    const donor = await service.findDonorByDonorId(donorId, programId);
    if (donor) {
      return res.status(200).json(sanitizeDonorOutput(donor));
    } else {
      return ControllerUtils.notFound(
        res,
        `No donor found with donorId: '${donorId}' in program: '${programId}'`,
      );
    }
  }

  /**
   * Returns every donor JSON document delmited by a new line character. Each document is written to the response stream as it is read in.
   * @param req
   * @param res
   * @returns
   */
  @HasProgramReadAccess((req: Request) => req.params.programId)
  async streamProgramDonors(req: Request, res: Response) {
    console.log(req.params);
    const programId = req.params.programId;
    if (!programId) {
      return ControllerUtils.badRequest(res, 'Invalid/Missing programId, e.g. ABCD-CA');
    }

    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Content-Type', 'application/x-ndjson');

    for await (const donor of service.iterateAllDonorsByProgramId(programId)) {
      res.write(JSON.stringify(sanitizeDonorOutput(donor)) + '\n');
    }

    res.end();
  }
}

function currentDateFormatted() {
  const now = new Date();
  return `${now.getFullYear()}${now.getMonth()}${now.getDate()}`;
}

/**
 * loop through all donor, specimen, and sample IDs and apply the require prefixes.
 * We also remove mongo specific properties and internal props that are not needed by consumers (e.g. `createBy`)
 * @param donor
 * @returns
 */
function sanitizeDonorOutput(donor: DeepReadonly<Donor>): any {
  return {
    ...omit(donor, '_id', '__v', 'createBy'),
    donorId: donor.donorId ? DonorUtils.prefixDonorId(donor.donorId) : '',
    specimens: donor.specimens.map(specimen => ({
      ...specimen,
      specimenId: specimen.specimenId ? DonorUtils.prefixSpecimenId(specimen.specimenId) : '',
      samples: specimen.samples.map(sample => ({
        ...sample,
        sampleId: sample.sampleId ? DonorUtils.prefixSampleId(sample.sampleId) : '',
      })),
    })),
  };
}

export default new ClinicalController();
