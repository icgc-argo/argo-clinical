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
import sinon from 'sinon';
import { donorDao as donorRepo } from '../../../../src/clinical/donor-repo';
import { TreatmentDetailException } from '../../../../src/exception/treatment-detail-exceptions/model';
import {
	create,
	deleteIdsByProgramId,
} from '../../../../src/exception/treatment-detail-exceptions/service';
import * as treatmentDetailExceptionsRepo from '../../../../src/exception/treatment-detail-exceptions/repo';
import { CreateResult, DeleteResult } from '../../../../src/exception/common';
import { Success, success } from '../../../../src/utils/results';

describe('Treatment Detail exception service', () => {
	const sandbox = sinon.createSandbox();
	afterEach(() => {
		// Restore the default sandbox here
		sandbox.restore();
	});

	describe('create', () => {
		let getByProgramStub: sinon.SinonStub<
			Parameters<typeof treatmentDetailExceptionsRepo.getByProgramId>,
			ReturnType<typeof treatmentDetailExceptionsRepo.getByProgramId>
		>;
		let createOrUpdateStub: sinon.SinonStub<
			Parameters<typeof treatmentDetailExceptionsRepo.createOrUpdate>,
			ReturnType<typeof treatmentDetailExceptionsRepo.createOrUpdate>
		>;
		let findDonorBySubmitterIdsStub: sinon.SinonStub<
			Parameters<typeof donorRepo.findByProgramAndSubmitterIds>,
			ReturnType<typeof donorRepo.findByProgramAndSubmitterIds>
		>;
		let saveDonorsStub: sinon.SinonStub<
			Parameters<typeof donorRepo.updateAll>,
			ReturnType<typeof donorRepo.updateAll>
		>;

		beforeEach(() => {
			getByProgramStub = sandbox.stub(treatmentDetailExceptionsRepo, 'getByProgramId');
			createOrUpdateStub = sandbox.stub(treatmentDetailExceptionsRepo, 'createOrUpdate');
			findDonorBySubmitterIdsStub = sandbox.stub(donorRepo, 'findByProgramAndSubmitterIds');
			saveDonorsStub = sandbox.stub(donorRepo, 'updateAll');
		});

		it('creates exception record', async () => {
			const inputs: Parameters<typeof create>[0] = {
				isDryRun: false,
				newDonorIds: ['DN001', 'DN002'],
				programId: 'EXAMPLE-CA',
			};

			// set empty return data for getByProgramId stub to trigger create
			getByProgramStub.returns(
				Promise.resolve(
					success({
						donorSubmitterIds: [],
						programId: inputs.programId,
					}),
				),
			);

			// createOrUpdate stub returns TreatmentDetailException with all donor IDs from inputs
			createOrUpdateStub.returns(
				Promise.resolve(
					success({
						donorSubmitterIds: inputs.newDonorIds,
						programId: inputs.programId,
					}),
				),
			);

			// create Treatment Detail Exception
			const result = (await create(inputs)) as Success<CreateResult>;

			chai.expect(result.data.donorsAddedCount).equals(2);
			chai.expect(result.data.donorsAdded).includes(inputs.newDonorIds[0]);
			chai.expect(result.data.donorsAdded).includes(inputs.newDonorIds[1]);
		});
	});

	describe('delete', () => {
		let getByProgramStub: sinon.SinonStub<
			Parameters<typeof treatmentDetailExceptionsRepo.getByProgramId>,
			ReturnType<typeof treatmentDetailExceptionsRepo.getByProgramId>
		>;

		let createOrUpdateStub: sinon.SinonStub<
			Parameters<typeof treatmentDetailExceptionsRepo.createOrUpdate>,
			ReturnType<typeof treatmentDetailExceptionsRepo.createOrUpdate>
		>;

		beforeEach(() => {
			getByProgramStub = sandbox.stub(treatmentDetailExceptionsRepo, 'getByProgramId');
			createOrUpdateStub = sandbox.stub(treatmentDetailExceptionsRepo, 'createOrUpdate');
		});

		it('removes submitter ids from exception', async () => {
			const programId = 'EXAMPLE-CA';
			const donorSubmitterIds = ['DN001'];
			const isDryRun = false;

			const exceptionResult: TreatmentDetailException = {
				donorSubmitterIds: ['DN001', 'DN002'],
				programId,
			};

			getByProgramStub.returns(Promise.resolve(success(exceptionResult)));

			const deleteResult: TreatmentDetailException = {
				donorSubmitterIds: ['DN002'],
				programId,
			};

			createOrUpdateStub.returns(Promise.resolve(success(deleteResult)));

			const result = (await deleteIdsByProgramId({
				programId,
				donorSubmitterIds,
				isDryRun,
			})) as Success<DeleteResult>;

			chai.expect(result.data.donorsDeleted).includes(donorSubmitterIds[0]);
		});
	});
});
