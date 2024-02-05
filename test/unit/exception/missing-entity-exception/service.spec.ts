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
import { create } from '../../../../src/exception/missing-entity-exceptions/service';
import * as missingEntityExceptionsRepo from '../../../../src/exception/missing-entity-exceptions/repo';
import { success } from '../../../../src/utils/results';
import * as statCalculator from '../../../../src/submission/submission-to-clinical/stat-calculator';

describe('missing entity exception service', () => {
	const sandbox = sinon.createSandbox();
	afterEach(() => {
		// Restore the default sandbox here
		sandbox.restore();
	});

	describe('create', () => {
		let getByProgramStub: sinon.SinonStub<
			Parameters<typeof missingEntityExceptionsRepo.getByProgramId>,
			ReturnType<typeof missingEntityExceptionsRepo.getByProgramId>
		>;
		let createOrUpdateStub: sinon.SinonStub<
			Parameters<typeof missingEntityExceptionsRepo.createOrUpdate>,
			ReturnType<typeof missingEntityExceptionsRepo.createOrUpdate>
		>;
		let findDonorBySubmitterIdsStub: sinon.SinonStub<
			Parameters<typeof donorRepo.findByProgramAndSubmitterIds>,
			ReturnType<typeof donorRepo.findByProgramAndSubmitterIds>
		>;
		let saveDonorsStub: sinon.SinonStub<
			Parameters<typeof donorRepo.updateAll>,
			ReturnType<typeof donorRepo.updateAll>
		>;
		let updateCompletStatsStub: sinon.SinonStub<
			Parameters<typeof statCalculator.updateDonorsCompletionStats>,
			ReturnType<typeof statCalculator.updateDonorsCompletionStats>
		>;

		beforeEach(() => {
			getByProgramStub = sandbox.stub(missingEntityExceptionsRepo, 'getByProgramId');
			createOrUpdateStub = sandbox.stub(missingEntityExceptionsRepo, 'createOrUpdate');
			findDonorBySubmitterIdsStub = sandbox.stub(donorRepo, 'findByProgramAndSubmitterIds');
			saveDonorsStub = sandbox.stub(donorRepo, 'updateAll');
			updateCompletStatsStub = sandbox.stub(statCalculator, 'updateDonorsCompletionStats');
		});
		it('triggers core calculation update for all donors', async () => {
			const inputs: Parameters<typeof create>[0] = {
				isDryRun: false,
				newDonorIds: ['asdf', 'qwerty'],
				programId: 'EXAMPLE-CA',
			};

			// set return data for getByProgramId stub, one existing donor
			getByProgramStub.returns(
				Promise.resolve(
					success({
						donorSubmitterIds: [inputs.newDonorIds[0]],
						programId: inputs.programId,
					}),
				),
			);

			// createOrUpdate stub returns missingEntityException with all donor IDs from inputs
			createOrUpdateStub.returns(
				Promise.resolve(
					success({
						donorSubmitterIds: inputs.newDonorIds,
						programId: inputs.programId,
					}),
				),
			);

			// create missing entity exception
			await create(inputs);

			// ensure that the update stats method is called as a consequence of creating an exception
			chai.expect(updateCompletStatsStub.calledOnce).to.be.true;
		});
	});
});
