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
import entityExceptionRepository from '../../../src/exception/repo/entity';
import programExceptionRepository from '../../../src/exception/repo/program';
import { EntityException } from '../../../src/exception/types';
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
      });

      chai.expect(result.filteredErrors).to.be.an('array').that.is.empty;
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
      };
      sinon.stub(entityExceptionRepository, 'find').returns(Promise.resolve(entityStub));
    });

    it('should return zero validation errors if valid entity exception exists', async () => {
      const record = {
        program_id: TEST_PROGRAM_ID,
        submitter_donor_id: 'DO-1',
        specimen_acquisition_interval: 'not applicable',
      };

      const result = await checkForProgramAndEntityExceptions({
        programId: TEST_PROGRAM_ID,
        schemaValidationErrors,
        record,
        schemaName: ClinicalEntitySchemaNames.SPECIMEN,
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
      });
      chai.expect(result.filteredErrors).deep.equal(schemaValidationErrors);
    });
  });
});