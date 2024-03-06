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

import { Request, Response } from 'express';
import * as service from '../clinical-service';
import { ClinicalDataQuery } from '../clinical-service';
import { getExceptionManifestRecords } from '../../submission/exceptions/exceptions';
import { ExceptionManifestRecord } from '../../exception/exception-manifest/types';
import {
	HasFullWriteAccess,
	ProtectTestEndpoint,
	HasProgramReadAccess,
	HasFullReadAccess,
} from '../../decorators';
import { ControllerUtils, DonorUtils, TsvUtils } from '../../utils';
import AdmZip from 'adm-zip';
import { ClinicalEntityData, Donor } from '../clinical-entities';
import { omit } from 'lodash';
import { DeepReadonly } from 'deep-freeze';
import {
	ClinicalDataApiBody,
	ClinicalErrorsApiBody,
	ClinicalSearchApiBody,
	CompletionState,
	DonorDataApiBody,
} from './types';
import { loggerFor } from '../../logger';
const L = loggerFor(__filename);

// TODO: Update value type to match mongo schema
export const completionFilters: Record<CompletionState, any> = {
	invalid: { 'schemaMetadata.isValid': false },
	complete: { 'completionStats.coreCompletionPercentage': 1 },
	incomplete: { 'completionStats.coreCompletionPercentage': { $lt: 1 } },
	all: {},
};

export const parseDonorIdList = (donorIds: string) =>
	donorIds
		?.match(/\d*/gi)
		?.filter((match: string) => !!match && parseInt(match))
		.map((id) => parseInt(id));

export const createClinicalZipFile = (
	data: ClinicalEntityData[],
	exceptionManifest?: {
		programShortName: string;
		exceptions: ExceptionManifestRecord[];
	},
) => {
	const zip = new AdmZip();
	data.forEach((entityData) => {
		const tsvData = TsvUtils.convertJsonRecordsToTsv(entityData.records, entityData.entityFields);
		zip.addFile(`${entityData.entityName}.tsv`, Buffer.alloc(tsvData.length, tsvData));
	});
	if (exceptionManifest && exceptionManifest.exceptions.length) {
		const headers = [exceptionManifest.programShortName];
		const tsvData = TsvUtils.convertJsonRecordsToTsv(exceptionManifest.exceptions, headers);
		zip.addFile(`exceptions.tsv`, Buffer.alloc(tsvData.length, tsvData));
	}
	return zip;
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

		const zip = createClinicalZipFile(data);

		res.send(zip.toBuffer());
	}

	@HasProgramReadAccess((req: Request) => req.params.programId)
	async getSpecificClinicalDataAsTsvsInZip(req: Request, res: Response) {
		const programShortName: string = req.params.programId;
		if (!programShortName) {
			return ControllerUtils.badRequest(res, 'Invalid programId provided');
		}
		const sort: string = 'donorId';
		const page: number = req.query.page;
		const pageSize: number = req.query.pageSize;

		const bodyParseResult = ClinicalDataApiBody.safeParse(req.body);
		if (!bodyParseResult.success) {
			return ControllerUtils.badRequest(
				res,
				`Invalid filter in request body: ${JSON.stringify(bodyParseResult.error)}`,
			);
		}
		const {
			completionState: state,
			donorIds,
			entityTypes,
			submitterDonorIds,
		} = bodyParseResult.data;
		const completionState = completionFilters[state];

		const query: ClinicalDataQuery = {
			sort,
			entityTypes,
			page,
			pageSize,
			donorIds,
			submitterDonorIds,
			completionState,
		};

		const entityData = await service
			.getPaginatedClinicalData(programShortName, query)
			.then((data) => data.clinicalEntities);

		const exceptions =
			(await getExceptionManifestRecords(programShortName, {
				donorIds,
				submitterDonorIds,
			})) || [];

		const fileEntityName = entityData.length === 1 ? `${entityData[0].entityName}_` : '';
		const todaysDate = currentDateFormatted();
		const fileName = `filename=${programShortName}_Clinical_Data_${fileEntityName}${todaysDate}.zip`;
		res
			.status(200)
			.contentType('application/zip')
			.attachment(fileName)
			.setHeader('content-disposition', fileName);

		const zip = createClinicalZipFile(entityData, { programShortName, exceptions });

		res.send(zip.toBuffer());
	}

	/**
	 * Download Clinical Data selected by Donor ID.
	 * Requires Full Read Access.
	 * Used by API for a user to download clinical data for specific donors and/or files.
	 * @param req
	 * @param res
	 * @returns
	 */
	@HasFullReadAccess()
	async getDonorDataByIdAsTsvsInZip(req: Request, res: Response) {
		const bodyParseResult = DonorDataApiBody.safeParse(req.body);
		if (!bodyParseResult.success) {
			return ControllerUtils.badRequest(
				res,
				`Invalid data in request body: ${JSON.stringify(bodyParseResult.error)}`,
			);
		}
		const { donorIds } = bodyParseResult.data;

		const donorEntityData = await service.getDonorEntityData(donorIds);

		const date = currentDateFormatted();
		const fileName = `filename=Donor_Clinical_Data_${date}.zip`;
		res
			.status(200)
			.contentType('application/zip')
			.attachment(fileName)
			.setHeader('content-disposition', fileName);

		const zip = createClinicalZipFile(donorEntityData);

		res.send(zip.toBuffer());
	}

	@HasProgramReadAccess((req: Request) => req.params.programId)
	async getProgramClinicalEntityData(req: Request, res: Response) {
		const programShortName: string = req.params.programId;
		if (!programShortName) {
			return ControllerUtils.badRequest(res, 'Invalid programId provided');
		}
		const sort: string = req.query.sort || 'donorId';
		const page: number = parseInt(req.query.page) || 0;
		const pageSize: number = parseInt(req.query.pageSize) || 20;

		const bodyParseResult = ClinicalDataApiBody.safeParse(req.body);
		if (!bodyParseResult.success) {
			return ControllerUtils.badRequest(
				res,
				`Invalid filter in request body: ${JSON.stringify(bodyParseResult.error)}`,
			);
		}
		const {
			completionState: state,
			donorIds,
			entityTypes,
			submitterDonorIds,
		} = bodyParseResult.data;
		const completionState = completionFilters[state];

		const query: ClinicalDataQuery = {
			sort,
			entityTypes,
			page,
			pageSize,
			donorIds,
			submitterDonorIds,
			completionState,
		};

		const entityData = await service.getPaginatedClinicalData(programShortName, query);

		res.status(200).json(entityData);
	}

	@HasProgramReadAccess((req: Request) => req.params.programId)
	async getProgramClinicalSearchResults(req: Request, res: Response) {
		const programShortName: string = req.params.programId;
		if (!programShortName) {
			return ControllerUtils.badRequest(res, 'Invalid programId provided');
		}

		const bodyParseResult = ClinicalSearchApiBody.safeParse(req.body);
		if (!bodyParseResult.success) {
			return ControllerUtils.badRequest(
				res,
				`Invalid filter in request body: ${JSON.stringify(bodyParseResult.error)}`,
			);
		}
		const {
			completionState: state,
			donorIds,
			entityTypes,
			submitterDonorIds,
		} = bodyParseResult.data;

		const completionState = completionFilters[state] || {};

		// FE filters digits out of search text for Donor search
		const query: ClinicalDataQuery = {
			donorIds,
			submitterDonorIds,
			entityTypes,
			completionState,
			page: 0,
			sort: 'donorId',
		};

		const searchData = await service.getClinicalSearchResults(programShortName, query);

		res.status(200).json(searchData);
	}

	/**
	 * Finds all Program Migration Errors, then finds which invalid Donors are now Valid post-migration.
	 * Filters out any errors related to Valid Donors, then revalidates remaining Donors,
	 * and returns the revised collection of Dictionary Validation Errors.
	 * @param programId string program name
	 * @param donorIds array of donor IDs
	 * @returns { ClinicalErrorsResponseRecord[] }
	 */
	@HasProgramReadAccess((req: Request) => req.params.programId)
	async getProgramClinicalErrors(req: Request, res: Response) {
		const programId = req.params.programId;
		if (!programId) {
			return ControllerUtils.badRequest(res, 'Invalid programId provided');
		}

		const bodyParseResult = ClinicalErrorsApiBody.safeParse(req.body);
		if (!bodyParseResult.success) {
			return ControllerUtils.badRequest(
				res,
				`Invalid filter in request body: ${JSON.stringify(bodyParseResult.error)}`,
			);
		}

		const queryIds = bodyParseResult.data.donorIds || [];

		const clinicalErrors = await service.getClinicalErrors(programId, queryIds);

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
	return `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`;
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
		specimens: donor.specimens.map((specimen) => ({
			...specimen,
			specimenId: specimen.specimenId ? DonorUtils.prefixSpecimenId(specimen.specimenId) : '',
			samples: specimen.samples.map((sample) => ({
				...sample,
				sampleId: sample.sampleId ? DonorUtils.prefixSampleId(sample.sampleId) : '',
			})),
		})),
	};
}

export default new ClinicalController();
