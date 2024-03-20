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
import * as clinicalService from '../../../../src/clinical/clinical-service';
import { isEntityManifestRecord } from '../../../../src/exception/exception-manifest/types';
import entityExceptionRepository from '../../../../src/exception/property-exceptions/repo/entity';
import programExceptionRepository from '../../../../src/exception/property-exceptions/repo/program';
import { isEntityExceptionRecord } from '../../../../src/exception/property-exceptions/types';
import * as missingEntityExceptionsRepo from '../../../../src/exception/missing-entity-exceptions/repo';
import { getExceptionManifestRecords } from '../../../../src/submission/exceptions/exceptions';
import { success } from '../../../../src/utils/results';
import {
	TEST_PROGRAM_ID,
	existingDonor01,
	existingDonor02,
	existingDonor03,
	existingDonor04,
	programExceptionStub,
	missingEntityStub,
	allEntitiesStub,
	sortingEntitiesStub,
	donorIdEntitiesStub,
	submitterIdEntitiesStub,
	emptyEntitiesStub,
	emptyProgramExceptionStub,
	emptyMissingEntityStub,
} from './stubs';

const stubDonors = [existingDonor01, existingDonor02, existingDonor03, existingDonor04];

const stubFilteredDonors = [existingDonor01, existingDonor02];

const programTestResult = {
	exceptionType: 'ProgramProperty',
	programId: 'TEST-IE',
	schemaName: 'treatment',
	propertyName: 'treatment_start_interval',
	exceptionValue: 'Unknown',
};

const entityTestResultA = {
	programId: 'TEST-IE',
	exceptionType: 'EntityProperty',
	schemaName: 'specimen',
	propertyName: 'specimen_acquisition_interval',
	exceptionValue: 'Not applicable',
	donorId: 0,
	submitterDonorId: 'DO-0',
	submitterEntityId: 'SP-0',
	entityId: 10,
};

const entityTestResultB = {
	programId: 'TEST-IE',
	exceptionType: 'EntityProperty',
	schemaName: 'treatment',
	propertyName: 'treatment_start_interval',
	exceptionValue: 'Unknown',
	donorId: 2,
	submitterDonorId: 'DO-2',
	submitterEntityId: 'T_02',
	entityId: 20,
};

const entityTestResultC = {
	programId: 'TEST-IE',
	exceptionType: 'EntityProperty',
	schemaName: 'follow_up',
	propertyName: 'interval_of_followUp',
	exceptionValue: 'Not applicable',
	donorId: 3,
	submitterDonorId: 'AB3',
	submitterEntityId: 'FL-0',
	entityId: 30,
};

const missingEntityTestResult = {
	programId: 'TEST-IE',
	exceptionType: 'MissingEntity',
	submitterDonorId: 'AB4',
	donorId: 4,
};

describe('Exception Manifest', () => {
	afterEach(() => {
		// Restore the default sandbox here
		sinon.restore();
	});

	describe('donorIds and submitterIds are empty', () => {
		before(() => {
			sinon.stub(programExceptionRepository, 'find').returns(Promise.resolve(programExceptionStub));
			sinon.stub(entityExceptionRepository, 'find').returns(Promise.resolve(allEntitiesStub));
			sinon
				.stub(missingEntityExceptionsRepo, 'getByProgramId')
				.returns(Promise.resolve(success(missingEntityStub)));
			sinon.stub(clinicalService, 'getDonors').returns(Promise.resolve(stubDonors));
			sinon.stub(clinicalService, 'getDonorsByIds').returns(Promise.resolve([]));
			sinon
				.stub(clinicalService, 'findDonorsBySubmitterIds')
				.returns(Promise.resolve([existingDonor03, existingDonor04]));
		});

		it('should return all types of Exception records', async () => {
			const result = await getExceptionManifestRecords(TEST_PROGRAM_ID, {
				donorIds: [],
				submitterDonorIds: [],
			});

			// Confirm array has all types of exception records
			chai
				.expect(result)
				.to.be.an('array')
				.with.lengthOf(5);

			chai.expect(result).to.deep.include(programTestResult);
			chai.expect(result).to.deep.include(entityTestResultA);
			chai.expect(result).to.deep.include(entityTestResultB);
			chai.expect(result).to.deep.include(entityTestResultC);
			chai.expect(result).to.deep.include(missingEntityTestResult);
		});
	});

	describe('records are sorted', () => {
		beforeEach(() => {
			sinon.stub(programExceptionRepository, 'find').returns(Promise.resolve(programExceptionStub));
			sinon.stub(entityExceptionRepository, 'find').returns(Promise.resolve(sortingEntitiesStub));
			sinon
				.stub(missingEntityExceptionsRepo, 'getByProgramId')
				.returns(Promise.resolve(success(missingEntityStub)));
			sinon.stub(clinicalService, 'getDonors').returns(Promise.resolve(stubDonors));
			sinon.stub(clinicalService, 'getDonorsByIds').returns(Promise.resolve([]));
			sinon
				.stub(clinicalService, 'findDonorsBySubmitterIds')
				.returns(Promise.resolve([existingDonor01, existingDonor04]));
		});

		it('should return Exception records sorted by: Program Exceptions, Submitter Donor ID, Exception Type, Schema, Submitter Entity ID', async () => {
			const result = await getExceptionManifestRecords(TEST_PROGRAM_ID, {
				donorIds: [],
				submitterDonorIds: [],
			});

			chai
				.expect(result)
				.to.be.an('array')
				.with.lengthOf(8);

			// Expect Program Exceptions sorted first
			chai
				.expect(result.findIndex((exception) => exception.exceptionType === 'ProgramProperty'))
				.equals(0);

			// Expect Missing Entity Exceptions sorted last
			chai
				.expect(result.findIndex((exception) => exception.exceptionType === 'MissingEntity'))
				.equals(result.length - 1);

			// expect Follow Up to have index < Specimen
			chai
				.expect(
					result.findIndex(
						(exception) =>
							isEntityManifestRecord(exception) && exception.schemaName === 'follow_up',
					),
				)
				.lessThan(
					result.findIndex(
						(exception) => isEntityManifestRecord(exception) && exception.schemaName === 'specimen',
					),
				);

			// expect Specimen to have index < Treatment
			chai
				.expect(
					result.findIndex(
						(exception) => isEntityManifestRecord(exception) && exception.schemaName === 'specimen',
					),
				)
				.lessThan(
					result.findIndex(
						(exception) =>
							isEntityManifestRecord(exception) && exception.schemaName === 'treatment',
					),
				);

			// expect Follow Up A to have index < Follow Up B
			chai
				.expect(
					result.findIndex(
						(exception) =>
							isEntityManifestRecord(exception) &&
							exception.schemaName === 'follow_up' &&
							exception.submitterDonorId === 'AB3',
					),
				)
				.lessThan(
					result.findIndex(
						(exception) =>
							isEntityManifestRecord(exception) &&
							exception.schemaName === 'follow_up' &&
							exception.submitterDonorId === 'DO-0',
					),
				);

			// expect Specimen A to have index < Specimen B
			chai
				.expect(
					result.findIndex(
						(exception) =>
							isEntityManifestRecord(exception) &&
							exception.schemaName === 'specimen' &&
							exception.submitterDonorId === 'AB4',
					),
				)
				.lessThan(
					result.findIndex(
						(exception) =>
							isEntityManifestRecord(exception) &&
							exception.schemaName === 'specimen' &&
							exception.submitterDonorId === 'DO-0',
					),
				);

			// expect Treatment A to have index < Treatment B
			chai
				.expect(
					result.findIndex(
						(exception) =>
							isEntityManifestRecord(exception) &&
							exception.schemaName === 'treatment' &&
							exception.submitterDonorId === 'AB3',
					),
				)
				.lessThan(
					result.findIndex(
						(exception) =>
							isEntityManifestRecord(exception) &&
							exception.schemaName === 'treatment' &&
							exception.submitterDonorId === 'DO-2',
					),
				);
		});
	});

	describe('Specific donorIds', () => {
		before(() => {
			sinon
				.stub(programExceptionRepository, 'find')
				.returns(Promise.resolve(emptyProgramExceptionStub));
			sinon.stub(entityExceptionRepository, 'find').returns(Promise.resolve(donorIdEntitiesStub));
			sinon
				.stub(missingEntityExceptionsRepo, 'getByProgramId')
				.returns(Promise.resolve(success(emptyMissingEntityStub)));
			sinon.stub(clinicalService, 'getDonors').returns(Promise.resolve([]));
			sinon.stub(clinicalService, 'getDonorsByIds').returns(Promise.resolve(stubFilteredDonors));
			sinon.stub(clinicalService, 'findDonorsBySubmitterIds').returns(Promise.resolve([]));
		});

		it('should return Exception records for specific Donor Ids', async () => {
			const result = await getExceptionManifestRecords(TEST_PROGRAM_ID, {
				donorIds: [0, 2],
				submitterDonorIds: [],
			});

			chai
				.expect(result)
				.to.be.an('array')
				.with.lengthOf(2);

			chai.expect(result).to.deep.include(entityTestResultA);
			chai.expect(result).to.deep.include(entityTestResultB);
		});
	});

	describe('Specific submitterIds', () => {
		before(() => {
			sinon
				.stub(programExceptionRepository, 'find')
				.returns(Promise.resolve(emptyProgramExceptionStub));
			sinon
				.stub(entityExceptionRepository, 'find')
				.returns(Promise.resolve(submitterIdEntitiesStub));
			sinon
				.stub(missingEntityExceptionsRepo, 'getByProgramId')
				.returns(Promise.resolve(success(missingEntityStub)));
			sinon.stub(clinicalService, 'getDonorsByIds').returns(Promise.resolve(stubDonors));
			sinon
				.stub(clinicalService, 'findDonorsBySubmitterIds')
				.returns(Promise.resolve([existingDonor03, existingDonor04]));
		});

		it('should return Exception records for specific Submitter Donor Ids', async () => {
			const result = await getExceptionManifestRecords(TEST_PROGRAM_ID, {
				donorIds: [],
				submitterDonorIds: ['AB3', 'AB4'],
			});

			chai
				.expect(result)
				.to.be.an('array')
				.with.lengthOf(2);

			chai.expect(result).to.deep.include(entityTestResultC);
			chai.expect(result).to.deep.include(missingEntityTestResult);
		});
	});

	describe('Failure', () => {
		before(() => {
			sinon
				.stub(programExceptionRepository, 'find')
				.returns(Promise.resolve(emptyProgramExceptionStub));
			sinon.stub(entityExceptionRepository, 'find').returns(Promise.resolve(emptyEntitiesStub));
			sinon
				.stub(missingEntityExceptionsRepo, 'getByProgramId')
				.returns(Promise.resolve(success(emptyMissingEntityStub)));
			sinon.stub(clinicalService, 'getDonors').returns(Promise.resolve([]));
			sinon.stub(clinicalService, 'getDonorsByIds').returns(Promise.resolve([]));
			sinon.stub(clinicalService, 'findDonorsBySubmitterIds').returns(Promise.resolve(undefined));
		});

		it('handles no data scenario', async () => {
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
