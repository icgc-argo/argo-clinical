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
import * as clinicalService from '../../../src/clinical/clinical-service';
import entityExceptionRepository from '../../../src/exception/property-exceptions/repo/entity';
import programExceptionRepository from '../../../src/exception/property-exceptions/repo/program';
import { EntityException } from '../../../src/exception/property-exceptions/types';
import * as missingEntityExceptionsRepo from '../../../src/exception/missing-entity-exceptions/repo';
import { MissingEntityException } from '../../../src/exception/missing-entity-exceptions/model';
import { getExceptionManifestRecords } from '../../../src/submission/exceptions/exceptions';
import { success } from '../../../src/utils/results';
import { existingDonor01, existingDonor02, existingDonor03 } from './stubs';

const TEST_PROGRAM_ID = 'TEST-IE';

const stubDonors = [existingDonor01, existingDonor02, existingDonor03];

const programExceptionStub = {
	programId: TEST_PROGRAM_ID,
	exceptions: [
		{
			program_name: TEST_PROGRAM_ID,
			schema: 'treatment',
			requested_core_field: 'treatment_start_interval',
			requested_exception_value: 'Unknown',
		},
	],
};

const followupExceptionStub = {
	program_name: TEST_PROGRAM_ID,
	requested_core_field: 'interval_of_followUp',
	schema: 'followUp',
	requested_exception_value: 'Not applicable',
	submitter_follow_up_id: 'FL-0',
	submitter_donor_id: 'DO-0',
};

const specimenExceptionStub = {
	program_name: TEST_PROGRAM_ID,
	requested_core_field: 'specimen_acquisition_interval',
	schema: 'specimen',
	requested_exception_value: 'Not applicable',
	submitter_specimen_id: 'SP-0',
	submitter_donor_id: 'DO-0',
};

const treatmentExceptionStub = {
	program_name: TEST_PROGRAM_ID,
	schema: 'treatment',
	requested_core_field: 'treatment_start_interval',
	requested_exception_value: 'Unknown',
	submitter_treatment_id: 'TR-0',
	submitter_donor_id: 'DO-0',
};

const entityStub: EntityException = {
	programId: TEST_PROGRAM_ID,
	specimen: [specimenExceptionStub],
	follow_up: [followupExceptionStub],
	treatment: [treatmentExceptionStub],
};

const missingEntityStub: MissingEntityException = {
	programId: TEST_PROGRAM_ID,
	donorSubmitterIds: ['AB3'],
};

describe('Submission Service Exception Manifest', () => {
	afterEach(() => {
		// Restore the default sandbox here
		sinon.restore();
	});
	describe('Exception Manifest', () => {
		beforeEach(() => {
			// queryForExceptions, getByProgramId
			sinon.stub(programExceptionRepository, 'find').returns(Promise.resolve(programExceptionStub));
			sinon.stub(entityExceptionRepository, 'find').returns(Promise.resolve(entityStub));
			sinon
				.stub(missingEntityExceptionsRepo, 'getByProgramId')
				.returns(Promise.resolve(success(missingEntityStub)));
			sinon.stub(clinicalService, 'getDonorsByIds').returns(Promise.resolve(stubDonors));
		});

		it('should return all types of Exception records', async () => {
			const result = await getExceptionManifestRecords(TEST_PROGRAM_ID, {
				donorIds: [1, 2],
				submitterDonorIds: ['AB3'],
			});

			// Confirm array has program exception, 2 entity exceptions, and missing entity exception
			chai
				.expect(result)
				.to.be.an('array')
				.with.lengthOf(5);
		});
	});
});
