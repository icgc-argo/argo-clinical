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

import { entities as dictionaryEntities } from '@overturebio-stack/lectern-client';
import { SchemaValidationErrorTypes } from '@overturebio-stack/lectern-client/lib/schema-entities';
import chai from 'chai';
import sinon from 'sinon';
import { ClinicalEntitySchemaNames } from '../../../src/common-model/entities';
import entityExceptionRepository from '../../../src/exception/property-exceptions/repo/entity';
import programExceptionRepository from '../../../src/exception/property-exceptions/repo/program';
import { EntityException } from '../../../src/exception/property-exceptions/types';
import { checkForProgramAndEntityExceptions } from '../../../src/submission/exceptions/exceptions';

const TEST_PROGRAM_ID = 'TEST-IE';

// schema error
const schemaValidationErrors: dictionaryEntities.SchemaValidationError[] = [
	{
		errorType: SchemaValidationErrorTypes.INVALID_FIELD_VALUE_TYPE,
		fieldName: 'specimen_acquisition_interval',
		index: 0,
		info: {
			value: ['Unknown'],
		},
		message: 'The value is not permissible for this field.',
	},
];

const mockSpecimenSchema: dictionaryEntities.SchemaDefinition = {
	name: 'specimen',
	description: 'Mock specimen schema',
	fields: [
		{
			name: 'specimen_acquisition_interval',
			valueType: dictionaryEntities.ValueType.STRING,
			description: 'Mock specimen field',
			meta: { core: true },
		},
	],
};

const mockTreatmentSchema: dictionaryEntities.SchemaDefinition = {
	name: 'treatment',
	description: 'Mock treatment schema',
	fields: [
		{
			name: 'mockEntitySchema',
			valueType: dictionaryEntities.ValueType.INTEGER,
			description: 'Mock treatment field',
			meta: { core: true },
		},
	],
};

describe('submission service apply exceptions', () => {
	afterEach(() => {
		// Restore the default sandbox here
		sinon.restore();
	});

	describe('program level Exceptions', () => {
		beforeEach(() => {
			// repo gives back nulls, idiomatic to mongoose
			// tslint:disable-next-line
			sinon.stub(entityExceptionRepository, 'find').returns(Promise.resolve(null));

			const programExceptionStub = {
				programId: TEST_PROGRAM_ID,
				exceptions: [
					{
						program_name: TEST_PROGRAM_ID,
						schema: 'specimen',
						requested_core_field: 'specimen_acquisition_interval',
						requested_exception_value: 'Unknown',
					},
					{
						program_name: TEST_PROGRAM_ID,
						schema: 'treatment',
						requested_core_field: 'treatment_start_interval',
						requested_exception_value: 'Unknown',
					},
				],
			};

			sinon.stub(programExceptionRepository, 'find').returns(Promise.resolve(programExceptionStub));
		});

		it('should return zero validation errors if valid program exception exists', async () => {
			const record = {
				program_id: TEST_PROGRAM_ID,
				submitter_donor_id: 'DO-1',
				specimen_acquisition_interval: 'unknown',
			};

			const result = await checkForProgramAndEntityExceptions({
				programId: TEST_PROGRAM_ID,
				schemaValidationErrors,
				record,
				schemaName: ClinicalEntitySchemaNames.SPECIMEN,
				entitySchema: mockSpecimenSchema,
			});

			chai.expect(result.filteredErrors).to.be.an('array').that.is.empty;
		});

		it('should return zero validation errors for blank numeric field', async () => {
			const record = {
				program_id: TEST_PROGRAM_ID,
				submitter_donor_id: 'DO-1',
				treatment_start_interval: undefined,
			};

			const validationErrors = [] as dictionaryEntities.SchemaValidationError[];

			const result = await checkForProgramAndEntityExceptions({
				programId: TEST_PROGRAM_ID,
				schemaValidationErrors: validationErrors,
				record,
				schemaName: ClinicalEntitySchemaNames.TREATMENT,
				entitySchema: mockTreatmentSchema,
			});

			chai.expect(result.filteredErrors).to.be.an('array').that.is.empty;
		});

		it('array field, single value - should return zero validation errors if valid program exception exists', async () => {
			const record = {
				program_id: TEST_PROGRAM_ID,
				submitter_donor_id: 'DO-1',
				specimen_acquisition_interval: ['unknown'],
			};

			const result = await checkForProgramAndEntityExceptions({
				programId: TEST_PROGRAM_ID,
				schemaValidationErrors,
				record,
				schemaName: ClinicalEntitySchemaNames.SPECIMEN,
				entitySchema: mockSpecimenSchema,
			});

			chai.expect(result.filteredErrors).to.be.an('array').that.is.empty;
		});

		it('array field, multiple values - should return validation errors, even if one value matches an exception', async () => {
			const record = {
				program_id: TEST_PROGRAM_ID,
				submitter_donor_id: 'DO-1',
				specimen_acquisition_interval: ['unknown', 'another value'],
			};

			const result = await checkForProgramAndEntityExceptions({
				programId: TEST_PROGRAM_ID,
				schemaValidationErrors,
				record,
				schemaName: ClinicalEntitySchemaNames.SPECIMEN,
				entitySchema: mockSpecimenSchema,
			});

			chai.expect(result.filteredErrors).deep.equal(schemaValidationErrors);
		});

		it('should return validation errors if there are no valid program exceptions ', async () => {
			const record = {
				program_id: TEST_PROGRAM_ID,
				submitter_donor_id: 'DO-1',
				specimen_anatomic_location: 'unknown',
			};

			const result = await checkForProgramAndEntityExceptions({
				programId: TEST_PROGRAM_ID,
				schemaValidationErrors,
				record,
				schemaName: ClinicalEntitySchemaNames.SPECIMEN,
				entitySchema: mockSpecimenSchema,
			});
			chai.expect(result.filteredErrors).deep.equal(schemaValidationErrors);
		});
	});

	describe('entity Level Exceptions', () => {
		beforeEach(() => {
			// repo gives back nulls, idiomatic to mongoose
			// tslint:disable-next-line
			sinon.stub(programExceptionRepository, 'find').returns(Promise.resolve(null));

			const entityStub: EntityException = {
				programId: TEST_PROGRAM_ID,
				specimen: [
					{
						program_name: TEST_PROGRAM_ID,
						requested_core_field: 'specimen_acquisition_interval',
						schema: 'specimen',
						requested_exception_value: 'Not applicable',
						submitter_specimen_id: 'SP-0',
						submitter_donor_id: 'DO-0',
					},
				],
				follow_up: [],
				treatment: [],
			};
			sinon.stub(entityExceptionRepository, 'find').returns(Promise.resolve(entityStub));
		});

		it('should return zero validation errors if valid entity exception exists', async () => {
			const record = {
				program_id: TEST_PROGRAM_ID,
				submitter_donor_id: 'DO-0',
				submitter_specimen_id: 'SP-0',
				specimen_acquisition_interval: 'not applicable',
			};

			const result = await checkForProgramAndEntityExceptions({
				programId: TEST_PROGRAM_ID,
				schemaValidationErrors,
				record,
				schemaName: ClinicalEntitySchemaNames.SPECIMEN,
				entitySchema: mockSpecimenSchema,
			});

			chai.expect(result.filteredErrors).to.be.an('array').that.is.empty;
			chai.expect(result.normalizedRecord.specimen_acquisition_interval).to.equal('Not applicable');
		});

		it('should return validation errors if there are no valid entity exceptions ', async () => {
			const record = {
				program_id: TEST_PROGRAM_ID,
				submitter_donor_id: 'DO-1',
				specimen_anatomic_location: 'unknown',
			};

			const result = await checkForProgramAndEntityExceptions({
				programId: TEST_PROGRAM_ID,
				schemaValidationErrors,
				record,
				schemaName: ClinicalEntitySchemaNames.SPECIMEN,
				entitySchema: mockSpecimenSchema,
			});
			chai.expect(result.filteredErrors).deep.equal(schemaValidationErrors);
		});
	});
});
