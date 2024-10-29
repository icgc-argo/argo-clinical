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

import { DeepReadonly } from 'deep-freeze';
import mongoose, { PaginateModel } from 'mongoose';
import { getRequiredDonorFieldsForEntityTypes } from '../common-model/functions';
import { F, MongooseUtils, notEmpty } from '../utils';
import { Donor } from './clinical-entities';
import { DonorDocument, DonorSchema } from './schemas';
import { ClinicalDataQuery, ClinicalDonorEntityQuery } from './types';

export const SUBMITTER_ID = 'submitterId';
export const SPECIMEN_SUBMITTER_ID = 'specimen.submitterId';
export const SPECIMEN_SAMPLE_SUBMITTER_ID = 'specimen.sample.submitterId';

const DonorModel = mongoose.model<DonorDocument, PaginateModel<DonorDocument>>(
	'Donor',
	DonorSchema,
);

export enum DONOR_DOCUMENT_FIELDS {
	SUBMITTER_ID = 'submitterId',
	DONOR_ID = 'donorId',
	SPECIMEN_SUBMITTER_ID = 'specimens.submitterId',
	SPECIMEN_SAMPLE_SUBMITTER_ID = 'specimens.samples.submitterId',
	FOLLOWUP_SUBMITTER_ID = 'followUps.clinicalInfo.submitter_follow_up_id',
	TREATMENT_SUBMITTER_ID = 'treatments.clinicalInfo.submitter_treatment_id',
	PROGRAM_ID = 'programId',
	LAST_MIGRATION_ID = 'schemaMetadata.lastMigrationId',
	GENDER = 'gender',
	SPECIMEN_TISSUE_SOURCE = 'specimens.specimenTissueSource',
	SPECIMEN_TYPE = 'specimens.specimenType',
	SPECIMEN_TUMOR_NORMAL_DESIGNATION = 'specimens.tumourNormalDesignation',
	SAMPLE_TYPE = 'specimens.samples.sampleType',
	PRIMARY_DIAGNOSIS_SUBMITTER_ID = 'primaryDiagnoses.clinicalInfo.submitter_primary_diagnosis_id',
	FAMILY_HISTORY_ID = 'familyHistory.clinicalInfo.family_relative_id',
}

const DONOR_ENTITY_CORE_FIELDS = [
	'donorId',
	'submitterId',
	'programId',
	'gender',
	'clinicalInfo',
	'updatedAt',
];

const DONOR_SEARCH_CORE_FIELDS = ['donorId', 'submitterId', 'programId', 'clinicalInfo'];

export type FindByProgramAndSubmitterFilter = DeepReadonly<{
	programId: string;
	submitterId: string;
}>;

export type FindPaginatedProgramFilter = {
	programId: string;
	submitterId?: { $in: '' };
	donorId?: { $in: '' };
};

export interface DonorRepository {
	findByClinicalEntitySubmitterIdAndProgramId(
		filters: DeepReadonly<FindByProgramAndSubmitterFilter>,
		submitterIdFieldName: DONOR_DOCUMENT_FIELDS,
	): Promise<DeepReadonly<Donor> | undefined>;
	insertDonors(donors: Donor[]): Promise<void>;
	updateDonor(donor: Donor): Promise<void>;
	findBy(criteria: any, limit: number): Promise<DeepReadonly<Donor[]>>;
	findOneBy(criteria: any): Promise<DeepReadonly<Donor | undefined>>;
	findByProgramId(
		programId: string,
		projections?: Partial<Record<DONOR_DOCUMENT_FIELDS, number>>,
		omitMongoDocIds?: boolean,
	): Promise<DeepReadonly<Donor[]>>;
	findByPaginatedProgramId(
		programId: string,
		query: ClinicalDataQuery,
	): Promise<DeepReadonly<{ donors: Donor[]; totalDonors: number }>>;
	findByProgramDonorSearch(
		programId: string,
		query: ClinicalDonorEntityQuery,
	): Promise<DeepReadonly<{ donors: Donor[] }>>;
	findByDonorIds(donorIds: number[]): Promise<DeepReadonly<Donor[]>>;
	deleteByProgramId(programId: string): Promise<void>;
	deleteByProgramIdAndDonorIds(programId: string, donorIds: number[]): Promise<void>;
	findByProgramAndSubmitterId(
		filters: DeepReadonly<FindByProgramAndSubmitterFilter[]>,
	): Promise<DeepReadonly<Donor[]> | undefined>;
	findByProgramAndSubmitterIds(
		programId: string,
		submitterIds: string[],
	): Promise<DeepReadonly<Donor[]> | undefined>;
	findBySpecimenSubmitterIdAndProgramId(
		filter: FindByProgramAndSubmitterFilter,
	): Promise<DeepReadonly<Donor> | undefined>;
	findBySampleSubmitterIdAndProgramId(
		filter: FindByProgramAndSubmitterFilter,
	): Promise<DeepReadonly<Donor> | undefined>;
	iterateAllByProgramId(programId: string): AsyncIterable<DeepReadonly<Donor>>;
	create(donor: DeepReadonly<Partial<Donor>>): Promise<DeepReadonly<Donor>>;
	update(donor: DeepReadonly<Donor>): Promise<DeepReadonly<Donor>>;
	updateAll(donors: DeepReadonly<Donor>[]): Promise<DeepReadonly<Donor>[]>;
}

// Mongoose implementation of the DonorRepository
export const donorDao: DonorRepository = {
	async insertDonors(donors: Donor[]) {
		// TODO: Review this
		type DonorRecord = Omit<Donor, '_id'>;
		const records = donors.map((donor) => donor as DonorRecord);
		await mongoose.connection.db?.collection('donors').insertMany(records);
	},
	async updateDonor(donor: Donor) {
		await mongoose?.connection.db
			?.collection('donors')
			.findOneAndUpdate({ donorId: donor.donorId }, { $set: donor });
	},

	async deleteByProgramId(programId: string): Promise<void> {
		await DonorModel.deleteMany({
			[DONOR_DOCUMENT_FIELDS.PROGRAM_ID]: programId,
		}).exec();
	},

	async deleteByProgramIdAndDonorIds(programId: string, donorIds: number[]): Promise<void> {
		await DonorModel.deleteMany({
			[DONOR_DOCUMENT_FIELDS.PROGRAM_ID]: programId,
			[DONOR_DOCUMENT_FIELDS.DONOR_ID]: {
				$in: donorIds,
			},
		}).exec();
	},

	async findBy(criteria: any, limit: number) {
		const result = await DonorModel.find(criteria)
			.limit(limit)
			.exec();
		// convert the id to string to avoid runtime error on freezing
		const mapped = result
			.map((d: DonorDocument) => {
				return MongooseUtils.toPojo(d) as Donor;
			})
			.filter(notEmpty);
		return F(mapped);
	},

	async findOneBy(criteria: any) {
		const result = await DonorModel.findOne(criteria).exec();
		if (result) {
			return F(MongooseUtils.toPojo(result) as Donor);
		} else {
			return undefined;
		}
	},

	async findByProgramId(
		programId: string,
		projection?: Partial<Record<DONOR_DOCUMENT_FIELDS, number>>,
		omitMongoDocIds?: boolean,
	): Promise<DeepReadonly<Donor[]>> {
		if (omitMongoDocIds) {
			return findByProgramIdOmitMongoDocId(programId, projection);
		}
		const result = await DonorModel.find(
			{
				[DONOR_DOCUMENT_FIELDS.PROGRAM_ID]: programId,
			},
			projection,
			{ sort: { [DONOR_DOCUMENT_FIELDS.DONOR_ID]: 1 } },
		).exec();

		// convert the id to string to avoid runtime error on freezing
		const mapped = result
			.map((d: DonorDocument) => {
				return MongooseUtils.toPojo(d) as Donor;
			})
			.filter(notEmpty);
		return F(mapped);
	},

	async findByPaginatedProgramId(
		programId: string,
		query: ClinicalDataQuery,
	): Promise<DeepReadonly<{ donors: Donor[]; totalDonors: number }>> {
		const {
			donorIds,
			submitterDonorIds,
			sort: querySort,
			page: queryPage,
			pageSize,
			entityTypes,
			completionState,
		} = query;

		const sortQuery = querySort.includes('-') ? { [querySort.slice(1)]: -1 } : { [querySort]: 1 };
		const sort = {
			'schemaMetadata.isValid': 1,
			'completionStats.coreCompletionPercentage': 1,
			...sortQuery,
		};

		const projection = [
			'-_id',
			'schemaMetadata',
			...DONOR_ENTITY_CORE_FIELDS,
			...entityTypes,
			...getRequiredDonorFieldsForEntityTypes(entityTypes),
		].join(' ');

		// All Entity Data is stored on Donor documents
		// Pagination and Search are handled downstream before response in service-worker-threads/tasks
		// For most use cases, all Donor documents must be retrieved for accurate filtering
		const limit =
			entityTypes.length === 1 && entityTypes.includes('donor') && pageSize
				? pageSize
				: await DonorModel.countDocuments({ programId });

		// Only requests for Specific Donor IDs can be paginated at the MongoDB level
		// React-Table Pagination is 0 indexed, BE Mongoose-Paginate is 1 indexed
		const page = entityTypes.length === 1 && entityTypes.includes('donor') ? queryPage + 1 : 1;

		const searchTerms = [];

		if (donorIds && donorIds.length > 0)
			searchTerms.push({
				donorId: { $in: donorIds },
			});

		if (submitterDonorIds && submitterDonorIds.length > 0)
			searchTerms.push({
				submitterId: { $in: submitterDonorIds },
			});

		const searchQuery =
			searchTerms.length > 0
				? {
						$or: searchTerms,
				  }
				: {};

		const result = await DonorModel.paginate(
			{
				programId,
				...completionState,
				...searchQuery,
			},
			{
				projection,
				sort,
				page,
				limit,
			},
		);

		const { totalDocs: totalDonors } = result;
		const mapped: Donor[] = result.docs
			.map((d: DonorDocument) => {
				return MongooseUtils.toPojo(d) as Donor;
			})
			.filter(notEmpty);

		return F({
			donors: mapped,
			totalDonors,
		});
	},

	async findByProgramDonorSearch(
		programId: string,
		query: ClinicalDataQuery,
	): Promise<DeepReadonly<{ donors: Donor[] }>> {
		const { entityTypes, completionState } = query;

		const projection: Record<string, number> = {
			_id: 0,
		};
		[
			...DONOR_SEARCH_CORE_FIELDS,
			...entityTypes,
			...getRequiredDonorFieldsForEntityTypes(entityTypes),
		].forEach((key: string) => (projection[key] = 1));

		const result = await DonorModel.find(
			{
				programId,
				...completionState,
			},
			projection,
		);

		const mapped: Donor[] = result
			.map((d: DonorDocument) => {
				return MongooseUtils.toPojo(d) as Donor;
			})
			.filter(notEmpty);

		return F({
			donors: mapped,
		});
	},

	async findBySpecimenSubmitterIdAndProgramId(
		filter: FindByProgramAndSubmitterFilter,
	): Promise<DeepReadonly<Donor> | undefined> {
		const result = await DonorModel.find({
			[DONOR_DOCUMENT_FIELDS.SPECIMEN_SUBMITTER_ID]: filter.submitterId,
			[DONOR_DOCUMENT_FIELDS.PROGRAM_ID]: filter.programId,
		}).exec();
		if (!result) {
			return undefined;
		}
		// convert the id to string to avoid runtime error on freezing
		const mapped = result.map((d: DonorDocument) => {
			return MongooseUtils.toPojo(d) as Donor;
		});
		if (mapped.length == 0) {
			return undefined;
		}
		return F(mapped[0]);
	},
	async findBySampleSubmitterIdAndProgramId(
		filter: FindByProgramAndSubmitterFilter,
	): Promise<DeepReadonly<Donor> | undefined> {
		const result = await DonorModel.find({
			[DONOR_DOCUMENT_FIELDS.SPECIMEN_SAMPLE_SUBMITTER_ID]: filter.submitterId,
			[DONOR_DOCUMENT_FIELDS.PROGRAM_ID]: filter.programId,
		}).exec();

		if (!result) {
			return undefined;
		}
		// convert the id to string to avoid runtime error on freezing
		const mapped = result.map((d: DonorDocument) => {
			return MongooseUtils.toPojo(d) as Donor;
		});
		if (mapped.length == 0) {
			return undefined;
		}
		return F(mapped[0]);
	},

	async findByClinicalEntitySubmitterIdAndProgramId(
		filter: DeepReadonly<FindByProgramAndSubmitterFilter>,
		submitterIdFieldName: DONOR_DOCUMENT_FIELDS,
	): Promise<DeepReadonly<Donor> | undefined> {
		const result = await DonorModel.find({
			[submitterIdFieldName]: filter.submitterId,
			[DONOR_DOCUMENT_FIELDS.PROGRAM_ID]: filter.programId,
		}).exec();

		if (!result) {
			return undefined;
		}
		// convert the id to string to avoid runtime error on freezing
		const mapped = result.map((d: DonorDocument) => {
			return MongooseUtils.toPojo(d) as Donor;
		});
		if (mapped.length == 0) {
			return undefined;
		}
		return F(mapped[0]);
	},

	async findByProgramAndSubmitterId(
		filter: { programId: string; submitterId: string }[],
	): Promise<DeepReadonly<Donor[]> | undefined> {
		const result = await DonorModel.find({
			$or: [...filter],
		}).exec();
		// convert the id to string to avoid runtime error on freezing
		const mapped = result.map((d: DonorDocument) => {
			return MongooseUtils.toPojo(d) as Donor;
		});
		return F(mapped);
	},
	async findByProgramAndSubmitterIds(
		programId: string,
		submitterIds: string[],
	): Promise<DeepReadonly<Donor[]> | undefined> {
		const result = await DonorModel.find({
			submitterId: { $in: submitterIds },
			programId: programId,
		});
		const mapped = result.map((d) => {
			return MongooseUtils.toPojo(d) as Donor;
		});
		return F(mapped);
	},

	async findByDonorIds(donorIds: number[]): Promise<DeepReadonly<Donor[]>> {
		const result = await DonorModel.find({
			donorId: { $in: donorIds },
		});
		const mapped = result.map((d) => {
			return MongooseUtils.toPojo(d) as Donor;
		});
		return F(mapped);
	},

	iterateAllByProgramId(programId: string) {
		return iterateAllByProgramId(programId);
	},

	async update(donor: DeepReadonly<Donor>) {
		const newDonor = new DonorModel(donor);
		unsetIsNewFlagForUpdate(newDonor);

		await newDonor.save();
		return F(MongooseUtils.toPojo(newDonor) as Donor);
	},

	async updateAll(donors: DeepReadonly<Donor>[]) {
		const newDonors = donors.map((donor) => {
			const newDonor = new DonorModel(donor);
			unsetIsNewFlagForUpdate(newDonor);
			return newDonor;
		});

		const results = await Promise.all(newDonors.map((donor) => donor.save()));
		return newDonors.map((donor) => F(MongooseUtils.toPojo(donor) as Donor));
	},

	async create(donor: DeepReadonly<Donor>) {
		const newDonor = new DonorModel(donor);
		const doc = await newDonor.save();
		return F(MongooseUtils.toPojo(newDonor) as Donor);
	},
};

export async function* iterateAllByProgramId(
	programId: string,
): AsyncIterable<DeepReadonly<Donor>> {
	const cursor = DonorModel.find({ programId }).cursor();
	for (let doc = await cursor.next(); doc; doc = await cursor.next()) {
		const donor = MongooseUtils.toPojo(doc) as Donor;
		yield F(donor);
	}
	return;
}

function unsetIsNewFlagForUpdate(newDonor: Donor) {
	(newDonor as any).isNew = false;
	newDonor.specimens.forEach((sp) => {
		if (sp.specimenId) {
			(sp as any).isNew = false;
		}

		sp.samples.forEach((sa) => {
			if (sa.sampleId) {
				(sa as any).isNew = false;
			}
		});
	});

	newDonor.primaryDiagnoses?.forEach((pd) => {
		if (pd.primaryDiagnosisId) {
			(pd as any).isNew = false;
		}
	});

	newDonor.familyHistory?.forEach((fh) => {
		if (fh.familyHistoryId) {
			(fh as any).isNew = false;
		}
	});

	newDonor.comorbidity?.forEach((cm) => {
		if (cm.comorbidityId) {
			(cm as any).isNew = false;
		}
	});

	newDonor.followUps?.forEach((fu) => {
		if (fu.followUpId) {
			(fu as any).isNew = false;
		}
	});

	newDonor.treatments?.forEach((tr) => {
		if (tr.treatmentId) {
			(tr as any).isNew = false;
		}
	});

	newDonor.exposure?.forEach((ex) => {
		if (ex.exposureId) {
			(ex as any).isNew = false;
		}
	});

	newDonor.biomarker?.forEach((bi) => {
		if (bi.biomarkerId) {
			(bi as any).isNew = false;
		}
	});
}

// Like findByProgramId, but DocQuery asks mongo to return PoJo without docIds for faster fetch
async function findByProgramIdOmitMongoDocId(
	programId: string,
	projection?: Partial<Record<DONOR_DOCUMENT_FIELDS, number>>,
): Promise<DeepReadonly<Donor[]>> {
	const result = await DonorModel.find(
		{
			[DONOR_DOCUMENT_FIELDS.PROGRAM_ID]: programId,
		},
		projection,
		{ sort: { [DONOR_DOCUMENT_FIELDS.DONOR_ID]: 1 } },
	)
		.select('-_id') // don't select '_id' so F() doesn't crash
		.lean() // ask mongo to return pojo only
		.exec();

	return F(result as Donor[]);
}
