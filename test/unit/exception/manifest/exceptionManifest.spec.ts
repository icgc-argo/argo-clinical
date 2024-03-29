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
import {
	isEntityManifestRecord,
	EntityPropertyExceptionRecord,
} from '../../../../src/exception/exception-manifest/types';
import entityExceptionRepository from '../../../../src/exception/property-exceptions/repo/entity';
import programExceptionRepository from '../../../../src/exception/property-exceptions/repo/program';
import * as missingEntityExceptionsRepo from '../../../../src/exception/missing-entity-exceptions/repo';
import * as treatmentDetailExceptionsRepo from '../../../../src/exception/treatment-detail-exceptions/repo';
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
	treatmentDetailStub,
	donorIdEntitiesStub,
	submitterIdEntitiesStub,
	emptyEntitiesStub,
	emptyProgramExceptionStub,
	emptyMissingEntityStub,
	emptyTreatmentDetailStub,
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

const missingEntityTestResultA = {
	programId: 'TEST-IE',
	exceptionType: 'MissingEntity',
	submitterDonorId: 'AB3',
	donorId: 3,
};

const missingEntityTestResultB = {
	programId: 'TEST-IE',
	exceptionType: 'MissingEntity',
	submitterDonorId: 'AB4',
	donorId: 4,
};

const missingEntityTestResultC = {
	programId: 'TEST-IE',
	exceptionType: 'MissingEntity',
	submitterDonorId: 'DO-0',
	donorId: 0,
};

const treatmentDetailTestResultA = {
	programId: 'TEST-IE',
	exceptionType: 'TreatmentDetail',
	submitterDonorId: 'AB3',
	donorId: 3,
};

const treatmentDetailTestResultB = {
	programId: 'TEST-IE',
	exceptionType: 'TreatmentDetail',
	submitterDonorId: 'DO-0',
	donorId: 0,
};

const treatmentDetailTestResultC = {
	programId: 'TEST-IE',
	exceptionType: 'TreatmentDetail',
	submitterDonorId: 'DO-2',
	donorId: 2,
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
			sinon
				.stub(treatmentDetailExceptionsRepo, 'getByProgramId')
				.returns(Promise.resolve(success(treatmentDetailStub)));
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
				.with.lengthOf(10);

			chai.expect(result).to.deep.include(programTestResult);
			chai.expect(result).to.deep.include(entityTestResultA);
			chai.expect(result).to.deep.include(entityTestResultB);
			chai.expect(result).to.deep.include(entityTestResultC);
			chai.expect(result).to.deep.include(missingEntityTestResultA);
			chai.expect(result).to.deep.include(missingEntityTestResultB);
			chai.expect(result).to.deep.include(missingEntityTestResultC);
			chai.expect(result).to.deep.include(treatmentDetailTestResultA);
			chai.expect(result).to.deep.include(treatmentDetailTestResultB);
			chai.expect(result).to.deep.include(treatmentDetailTestResultC);
		});
	});

	describe('records are sorted', () => {
		beforeEach(() => {
			sinon.stub(programExceptionRepository, 'find').returns(Promise.resolve(programExceptionStub));
			sinon.stub(entityExceptionRepository, 'find').returns(Promise.resolve(sortingEntitiesStub));
			sinon
				.stub(missingEntityExceptionsRepo, 'getByProgramId')
				.returns(Promise.resolve(success(missingEntityStub)));
			sinon
				.stub(treatmentDetailExceptionsRepo, 'getByProgramId')
				.returns(Promise.resolve(success(treatmentDetailStub)));
			sinon.stub(clinicalService, 'getDonors').returns(Promise.resolve(stubDonors));
			sinon.stub(clinicalService, 'getDonorsByIds').returns(Promise.resolve([]));
			sinon
				.stub(clinicalService, 'findDonorsBySubmitterIds')
				.returns(Promise.resolve([existingDonor01, existingDonor04]));
		});

		it('should return Exception records in correct sort order', async () => {
			const result = await getExceptionManifestRecords(TEST_PROGRAM_ID, {
				donorIds: [],
				submitterDonorIds: [],
			});

			// Expected sort order:
			// Program Exceptions
			// Entity Property Exceptions:
			//  - Submitter Donor ID
			//  - Schema
			//  - Submitter Entity ID
			// Missing Entity Exceptions
			//  - Submitter Donor ID
			// Treatment Details Exceptions
			//  - Submitter Donor ID

			chai
				.expect(result)
				.to.be.an('array')
				.with.lengthOf(15);

			// Expect Program Exceptions sorted first
			chai
				.expect(result.findIndex((exception) => exception.exceptionType === 'ProgramProperty'))
				.equals(0);

			// Expect Missing Entity Exceptions sorted after Entity Property exceptions
			chai
				.expect(result.findIndex((exception) => exception.exceptionType === 'MissingEntity'))
				.greaterThan(result.findIndex((exception) => exception.exceptionType === 'EntityProperty'));

			// Expect Treatment Detail Exceptions sorted last
			chai
				.expect(
					result.findIndex(
						(exception) =>
							exception.exceptionType === 'TreatmentDetail' &&
							exception.submitterDonorId === treatmentDetailTestResultC.submitterDonorId,
					),
				)
				.equals(result.length - 1);
			// Test Entities
			const entityResults = result.filter((exception) =>
				isEntityManifestRecord(exception),
			) as EntityPropertyExceptionRecord[];

			// expect Follow Up to have index < Specimen
			chai
				.expect(entityResults.findIndex((exception) => exception.schemaName === 'follow_up'))
				.lessThan(entityResults.findIndex((exception) => exception.schemaName === 'specimen'));

			// expect Specimen to have index < Treatment
			chai
				.expect(entityResults.findIndex((exception) => exception.schemaName === 'specimen'))
				.lessThan(entityResults.findIndex((exception) => exception.schemaName === 'treatment'));

			// Test Submitter Donor Ids
			// expect Follow Up A to have index < Follow Up B
			const followUpExceptions = entityResults.filter(
				(exception) => exception.schemaName === 'follow_up',
			);
			chai
				.expect(followUpExceptions.findIndex((exception) => exception.submitterDonorId === 'AB3'))
				.lessThan(
					followUpExceptions.findIndex((exception) => exception.submitterDonorId === 'DO-0'),
				);

			// expect Specimen A to have index < Specimen B
			const specimenExceptions = entityResults.filter(
				(exception) => exception.schemaName === 'specimen',
			);
			chai
				.expect(specimenExceptions.findIndex((exception) => exception.submitterDonorId === 'AB4'))
				.lessThan(
					specimenExceptions.findIndex((exception) => exception.submitterDonorId === 'DO-0'),
				);

			// expect Treatment A to have index < Treatment B
			const treatmentExceptions = entityResults.filter(
				(exception) => exception.schemaName === 'treatment',
			);
			chai
				.expect(treatmentExceptions.findIndex((exception) => exception.submitterDonorId === 'AB3'))
				.lessThan(entityResults.findIndex((exception) => exception.submitterDonorId === 'DO-2'));

			// Test Entity Id A to have index < Entity Id B
			chai
				.expect(
					treatmentExceptions.findIndex((exception) => exception.submitterEntityId === 'T_05'),
				)
				.lessThan(entityResults.findIndex((exception) => exception.submitterEntityId === 'T_06'))
				.and.lessThan(
					entityResults.findIndex((exception) => exception.submitterEntityId === 'T_07'),
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
			sinon
				.stub(treatmentDetailExceptionsRepo, 'getByProgramId')
				.returns(Promise.resolve(success(emptyTreatmentDetailStub)));
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
			sinon
				.stub(treatmentDetailExceptionsRepo, 'getByProgramId')
				.returns(Promise.resolve(success(emptyTreatmentDetailStub)));
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
				.with.lengthOf(4);

			chai.expect(result).to.deep.include(entityTestResultC);
			chai.expect(result).to.deep.include(missingEntityTestResultA);
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
			sinon
				.stub(treatmentDetailExceptionsRepo, 'getByProgramId')
				.returns(Promise.resolve(success(emptyTreatmentDetailStub)));
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
