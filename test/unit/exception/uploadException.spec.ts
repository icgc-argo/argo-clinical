/*
 * Copyright (c) 2022 The Ontario Institute for Cancer Research. All rights reserved
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

// @ts-nocheck

import chai from 'chai';
import { ExceptionValue } from '../../../src/exception/types';
import { validateRecords, ValidationResultType } from '../../../src/exception/validation';
import sinon from 'sinon';
import * as dictionaryManager from '../../../src/dictionary/manager';
import { programValidators } from '../../../src/exception/exception-service';

const emptyFields = [
  {
    program_name: 'TESxT-IE',
    schema: '',
    requested_core_field: 'is_primary_treatment',
    requested_exception_value: ExceptionValue.Unknown,
  },
];

function expectToHaveErrors(result: any, length = 1) {
  chai.expect(result).to.be.instanceOf(Array);
  chai.expect(result).to.have.lengthOf(length, 'unexpected error result array size');
}

function expectValidationError(row: any, recordIndex: any, validationResultType: any) {
  chai.expect(row.recordIndex).to.eq(recordIndex);
  chai.expect(row.message).to.be.a('string');
  chai.expect(row.message.length).to.be.greaterThan(0);
  chai.expect(row.result).to.equal(validationResultType);
}

describe('program exception service', () => {
  afterEach(() => {
    // Restore the default sandbox here
    sinon.restore();
  });

  it('should check for empty fields', async () => {
    sinon.stub(dictionaryManager, 'instance').returns({
      getSchemasWithFields: () => [
        { name: 'treatment', fields: [{ name: 'is_primary_treatment', meta: { core: true } }] },
      ],
    });

    const result = await validateRecords(
      emptyFields[0].program_name,
      emptyFields,
      programValidators,
    );

    expectToHaveErrors(result);
    // row is +1 because row 0 is header row of tsv for end user
    expectValidationError(result[0], 1, ValidationResultType.EMPTY_FIELD);
  });
  it('should check if program id matches program_name in records', async () => {
    sinon.stub(dictionaryManager, 'instance').returns({
      getSchemasWithFields: () => [
        {
          name: 'treatment',
          fields: [{ name: 'is_primary_treatment', meta: { core: true } }],
        },
      ],
    });

    const programId = 'CIA-IE';
    const result = await validateRecords(
      programId,
      [
        {
          program_name: 'NOT-CIA-IE',
          schema: 'treatment',
          requested_core_field: 'is_primary_treatment',
          requested_exception_value: ExceptionValue.Unknown,
        },
      ],
      programValidators,
    );
    expectToHaveErrors(result);
    expectValidationError(result[0], 1, ValidationResultType.PARAM_INVALID);
  });
  it('should check if submitted schema is valid schema', async () => {
    sinon.stub(dictionaryManager, 'instance').returns({
      getSchemasWithFields: () => [],
    });

    const result = await validateRecords(
      'CIA-IE',
      [
        {
          program_name: 'CIA-IE',
          schema: 'not_a_valid_schema',
          requested_core_field: 'is_primary_treatment',
          requested_exception_value: ExceptionValue.Unknown,
        },
      ],
      programValidators,
    );
    expectToHaveErrors(result, 2);
    expectValidationError(result[0], 1, ValidationResultType.INVALID);
  });
  it('should check that requested exception value only accepts valid values', async () => {
    sinon.stub(dictionaryManager, 'instance').returns({
      getSchemasWithFields: () => [
        {
          name: 'treatment',
          fields: [{ name: 'is_primary_treatment', meta: { core: true } }],
        },
      ],
    });

    const result = await validateRecords(
      'CIA-IE',
      [
        {
          program_name: 'CIA-IE',
          schema: 'not_a_valid_schema',
          requested_core_field: 'is_primary_treatment',
          requested_exception_value: 'invalid_exception_value',
        },
      ],
      programValidators,
    );
    expectToHaveErrors(result, 1);
    expectValidationError(result[0], 1, ValidationResultType.INVALID);
  });
});
