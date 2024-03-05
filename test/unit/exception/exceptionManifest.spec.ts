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
import * as missingEntityExceptionsRepo from '../../../src/exception/missing-entity-exceptions/repo';
import { getExceptionManifestRecords } from '../../../src/submission/exceptions/exceptions';
import { success } from '../../../src/utils/results';
import {
	TEST_PROGRAM_ID,
	existingDonor01,
	existingDonor02,
	existingDonor03,
	programExceptionStub,
	missingEntityStub,
	allEntitiesStub,
	emptyEntitiesStub,
	emptyProgramExceptionStub,
	emptyMissingEntityStub,
} from './stubs';

const stubDonors = [existingDonor01, existingDonor02, existingDonor03];

describe('Submission Service Exception Manifest', () => {
	afterEach(() => {
		// Restore the default sandbox here
		sinon.restore();
	});

	describe('Exception Manifest - Success', () => {
		before(() => {
			sinon.stub(programExceptionRepository, 'find').returns(Promise.resolve(programExceptionStub));
			sinon.stub(entityExceptionRepository, 'find').returns(Promise.resolve(allEntitiesStub));
			sinon
				.stub(missingEntityExceptionsRepo, 'getByProgramId')
				.returns(Promise.resolve(success(missingEntityStub)));
			sinon.stub(clinicalService, 'getDonorsByIds').returns(Promise.resolve(stubDonors));
			sinon
				.stub(clinicalService, 'findDonorBySubmitterId')
				.returns(Promise.resolve(existingDonor03));
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

	describe('Exception Manifest - Failure', () => {
		before(() => {
			sinon
				.stub(programExceptionRepository, 'find')
				.returns(Promise.resolve(emptyProgramExceptionStub));
			sinon.stub(entityExceptionRepository, 'find').returns(Promise.resolve(emptyEntitiesStub));
			sinon
				.stub(missingEntityExceptionsRepo, 'getByProgramId')
				.returns(Promise.resolve(success(emptyMissingEntityStub)));
			sinon.stub(clinicalService, 'getDonorsByIds').returns(Promise.resolve([]));
			sinon.stub(clinicalService, 'findDonorBySubmitterId').returns(Promise.resolve(undefined));
		});

		it('handles empty values', async () => {
			const result = await getExceptionManifestRecords(TEST_PROGRAM_ID, {
				donorIds: [],
				submitterDonorIds: [],
			});

			chai
				.expect(result)
				.to.be.an('array')
				.with.lengthOf(0);
		});
	});
});
