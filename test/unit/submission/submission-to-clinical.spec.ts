/*
 * Copyright (c) 2024 The Ontario Institute for Cancer Research. All rights reserved
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

import chai from 'chai';
import * as sinon from 'sinon';
import * as s2c from '../../../src/submission/submission-to-clinical/submission-to-clinical';

import deepFreeze from 'deep-freeze';
import { Donor } from '../../../src/clinical/clinical-entities';
import { donorDao, FindByProgramAndSubmitterFilter } from '../../../src/clinical/donor-repo';
import { MissingEntityException } from '../../../src/exception/missing-entity-exceptions/model';
import { registrationRepository } from '../../../src/submission/registration-repo';
import { ActiveRegistration } from '../../../src/submission/submission-entities';
import { Result } from '../../../src/utils/results';
import * as missingEntityExceptionRepo from '../../../src/exception/missing-entity-exceptions/repo';

const id1 = '04042314bacas';
const id2 = 'lafdksaf92149123';
const reg1: ActiveRegistration = {
	_id: id1,
	creator: 'test',
	schemaVersion: '1.0',
	programId: 'ABCD-EF',
	batchName: 'registration1.tsv',
	stats: {
		alreadyRegistered: [],
		newDonorIds: [
			{
				submitterId: 'abcd123',
				rowNumbers: [0],
			},
		],
		newSpecimenIds: [
			{
				submitterId: 'ss123',
				rowNumbers: [0],
			},
		],
		newSampleIds: [
			{
				submitterId: 'sm123',
				rowNumbers: [0],
			},
		],
	},
	records: [
		{
			program_id: 'ABCD-EF',
			submitter_donor_id: 'abcd123',
			gender: 'Male',
			submitter_specimen_id: 'ss123',
			specimen_tissue_source: 'Other',
			tumour_normal_designation: 'Normal',
			specimen_type: 'Normal',
			submitter_sample_id: 'sm123',
			sample_type: 'ctDNA',
		},
	],
};

const reg2: ActiveRegistration = {
	_id: id2,
	creator: 'test',
	programId: 'ABCD-EF',
	batchName: 'registration2.tsv',
	schemaVersion: '1.0',
	stats: {
		alreadyRegistered: [],
		newDonorIds: [],
		newSpecimenIds: [
			{
				submitterId: 'ss123',
				rowNumbers: [0],
			},
		],
		newSampleIds: [
			{
				submitterId: 'sm123',
				rowNumbers: [0],
			},
		],
	},
	records: [
		{
			program_id: 'ABCD-EF',
			submitter_donor_id: 'abcd123',
			gender: 'Male',
			submitter_specimen_id: 'ss123',
			specimen_tissue_source: 'Other',
			tumour_normal_designation: 'Normal',
			specimen_type: 'Normal',
			submitter_sample_id: 'sm123',
			sample_type: 'ctDNA',
		},
	],
};

describe('submission-to-clinical', () => {
	describe('commit registration', () => {
		let registrationRepoFindByIdStub: sinon.SinonStub<
			[string],
			Promise<deepFreeze.DeepReadonly<ActiveRegistration> | undefined>
		>;
		let findByProgramAndSubmitterIdStub: sinon.SinonStub<
			[
				readonly deepFreeze.DeepReadonly<
					deepFreeze.DeepReadonly<{
						programId: string;
						submitterId: string;
					}>
				>[],
			],
			Promise<readonly deepFreeze.DeepReadonly<Donor>[] | undefined>
		>;
		let deleteRegStub: sinon.SinonStub<[string], Promise<void>>;
		let createDonorStub: sinon.SinonStub<
			[deepFreeze.DeepReadonly<Partial<Donor>>],
			Promise<deepFreeze.DeepReadonly<Donor>>
		>;
		let updateDonorStub: sinon.SinonStub<
			[deepFreeze.DeepReadonly<Donor>],
			Promise<deepFreeze.DeepReadonly<Donor>>
		>;
		let missingEntityRepoGetByProgramStub: sinon.SinonStub<
			[string],
			Promise<Result<MissingEntityException>>
		>;
		const sandBox = sinon.createSandbox();

		beforeEach((done) => {
			// it's important to define stubs in scope otherwise mocha will excute them globally.
			registrationRepoFindByIdStub = sandBox.stub(registrationRepository, 'findById');
			findByProgramAndSubmitterIdStub = sandBox.stub(donorDao, 'findByProgramAndSubmitterId');
			deleteRegStub = sandBox.stub(registrationRepository, 'delete');
			createDonorStub = sandBox.stub(donorDao, 'create');
			updateDonorStub = sandBox.stub(donorDao, 'update');
			missingEntityRepoGetByProgramStub = sandBox.stub(
				missingEntityExceptionRepo,
				'getByProgramId',
			);
			done();
		});

		afterEach((done) => {
			sandBox.restore();
			done();
		});

		it('should create donor if not existing', async () => {
			const filter: FindByProgramAndSubmitterFilter = {
				submitterId: 'abcd123',
				programId: 'ABCD-EF',
			};

			const expectedDonorDto: Partial<Donor> = {
				schemaMetadata: {
					isValid: true,
					lastValidSchemaVersion: '1.0',
					originalSchemaVersion: '1.0',
				},
				gender: 'Male',
				submitterId: 'abcd123',
				programId: 'ABCD-EF',
				specimens: [
					{
						samples: [
							{
								sampleType: 'ctDNA',
								submitterId: 'sm123',
							},
						],
						clinicalInfo: {},
						specimenTissueSource: 'Other',
						tumourNormalDesignation: 'Normal',
						specimenType: 'Normal',
						submitterId: 'ss123',
					},
				],
				clinicalInfo: {},
				primaryDiagnoses: undefined,
				followUps: [],
				treatments: [],
			};

			registrationRepoFindByIdStub.withArgs(id1).returns(Promise.resolve(reg1));
			findByProgramAndSubmitterIdStub.withArgs(sinon.match([filter])).returns(Promise.resolve([]));
			const result = await s2c.commitRegistration({
				programId: reg1.programId,
				registrationId: reg1._id as string,
			});
			chai.expect(createDonorStub.calledOnceWith(sinon.match(expectedDonorDto))).to.eq(true);
			chai.expect(deleteRegStub.calledOnceWithExactly(id1)).to.eq(true);
		});

		it('should update donor if existing', async () => {
			const filter: FindByProgramAndSubmitterFilter = {
				submitterId: 'abcd123',
				programId: 'ABCD-EF',
			};

			const existingDonor: Donor = {
				schemaMetadata: {
					isValid: true,
					lastValidSchemaVersion: '1.0',
					originalSchemaVersion: '1.0',
				},
				_id: 'lkjsdal214',
				donorId: 3023,
				gender: 'Male',
				programId: 'ABCD-EF',
				submitterId: 'abcd123',
				specimens: [
					{
						specimenId: 320,
						specimenTissueSource: 'Other',
						submitterId: 'ss330',
						clinicalInfo: {},
						tumourNormalDesignation: 'Normal',
						specimenType: 'Normal',
						samples: [
							{
								sampleId: 39,
								sampleType: 'RNA',
								submitterId: 'sr342',
							},
						],
					},
				],
			};

			const expectedDonorDto: Donor = {
				schemaMetadata: {
					isValid: true,
					lastValidSchemaVersion: '1.0',
					originalSchemaVersion: '1.0',
				},
				_id: 'lkjsdal214',
				donorId: 3023,
				gender: 'Male',
				programId: 'ABCD-EF',
				submitterId: 'abcd123',
				specimens: [
					{
						specimenId: 320,
						specimenTissueSource: 'Other',
						submitterId: 'ss330',
						clinicalInfo: {},
						tumourNormalDesignation: 'Normal',
						specimenType: 'Normal',
						samples: [
							{
								sampleId: 39,
								sampleType: 'RNA',
								submitterId: 'sr342',
							},
						],
					},
					{
						samples: [
							{
								sampleType: 'ctDNA',
								submitterId: 'sm123',
							},
						],
						clinicalInfo: {},
						specimenTissueSource: 'Other',
						tumourNormalDesignation: 'Normal',
						specimenType: 'Normal',
						submitterId: 'ss123',
					},
				],
			};

			registrationRepoFindByIdStub.withArgs(id2).returns(Promise.resolve(reg2));

			findByProgramAndSubmitterIdStub
				.withArgs(sinon.match([filter]))
				.returns(Promise.resolve([existingDonor]));

			missingEntityRepoGetByProgramStub.returns(
				Promise.resolve({
					success: true,
					data: { donorSubmitterIds: [], programId: 'ABCD-EF' },
				}),
			);

			const result = await s2c.commitRegistration({
				programId: reg2.programId,
				registrationId: reg2._id as string,
			});
			chai.expect(updateDonorStub.calledOnceWith(sinon.match(expectedDonorDto))).to.eq(true);
			chai.expect(deleteRegStub.calledOnceWithExactly(id2)).to.eq(true);
		});
	});
});
