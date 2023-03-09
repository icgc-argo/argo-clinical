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

import chai from 'chai';
import { ExceptionValue, ProgramExceptionRecord } from '../../../src/exception/types';
import {
  commonValidators,
  validateRecords,
  ValidationResultType,
} from '../../../src/exception/validation';
import sinon from 'sinon';
import * as dictionaryManager from '../../../src/dictionary/manager';

function expectToHaveNumberOfErrors(result: any, length = 1) {
  chai.expect(result).to.be.instanceOf(Array);
  chai.expect(result).to.have.lengthOf(length, 'unexpected error result array size');
}

function expectValidationError(row: any, recordIndex: any, validationResultType: any) {
  chai.expect(row.recordIndex).to.eq(recordIndex);
  chai.expect(row.message).to.be.a('string');
  chai.expect(row.message.length).to.be.greaterThan(0);
  chai.expect(row.result).to.equal(validationResultType);
}

function expectZeroValidationErrors(result: any) {
  chai.expect(result).to.be.empty;
}

const DEFAULT_PROGRAM_ID = 'TEST-IE';
function createRecord(
  record: Partial<ProgramExceptionRecord> = {},
  programId = DEFAULT_PROGRAM_ID,
) {
  return {
    ...{
      program_name: programId,
      schema: 'treatment',
      requested_core_field: 'is_primary_treatment',
      requested_exception_value: ExceptionValue.Unknown,
    },
    ...record,
  };
}

describe('program exception service', () => {
  afterEach(() => {
    // Restore the default sandbox here
    sinon.restore();
  });

  describe('req param should match submitted program_name in tsv', () => {
    it('[positive] should succeed if req param program id matches program_name in records', async () => {
      sinon.stub(dictionaryManager, 'instance').returns({
        // @ts-ignore
        getSchemasWithFields: () => [
          {
            name: 'treatment',
            fields: [{ name: 'is_primary_treatment', meta: { core: true } }],
          },
        ],
      });

      const record = createRecord();
      const result = await validateRecords(DEFAULT_PROGRAM_ID, [record], commonValidators);
      expectZeroValidationErrors(result);
    });

    it('[negative] should error if req param program id does not match program_name in records', async () => {
      sinon.stub(dictionaryManager, 'instance').returns({
        // @ts-ignore
        getSchemasWithFields: () => [
          {
            name: 'treatment',
            fields: [{ name: 'is_primary_treatment', meta: { core: true } }],
          },
        ],
      });

      const record = createRecord({
        program_name: 'NOT-TEST-IE',
      });
      const result = await validateRecords(DEFAULT_PROGRAM_ID, [record], commonValidators);
      expectToHaveNumberOfErrors(result);
      expectValidationError(result[0], 1, ValidationResultType.PARAM_INVALID);
    });
  });

  describe('check for empty fields', () => {
    it('[positive] should succeed if no empty fields', async () => {
      sinon.stub(dictionaryManager, 'instance').returns({
        // @ts-ignore
        getSchemasWithFields: () => [
          { name: 'treatment', fields: [{ name: 'is_primary_treatment', meta: { core: true } }] },
        ],
      });

      const record = createRecord({ schema: '' });
      const result = await validateRecords(DEFAULT_PROGRAM_ID, [record], commonValidators);
      expectToHaveNumberOfErrors(result);
      expectValidationError(result[0], 1, ValidationResultType.EMPTY_FIELD);
    });

    it('[negative] should error if there are empty fields', async () => {
      sinon.stub(dictionaryManager, 'instance').returns({
        // @ts-ignore
        getSchemasWithFields: () => [
          { name: 'treatment', fields: [{ name: 'is_primary_treatment', meta: { core: true } }] },
        ],
      });

      const record = createRecord({ schema: '' });
      const result = await validateRecords(DEFAULT_PROGRAM_ID, [record], commonValidators);

      expectToHaveNumberOfErrors(result);
      expectValidationError(result[0], 1, ValidationResultType.EMPTY_FIELD);
    });
  });

  describe('schema', () => {
    it('[positive] should return success when submitted schema is valid schema', async () => {
      sinon.stub(dictionaryManager, 'instance').returns({
        // @ts-ignore
        getSchemasWithFields: () => [
          {
            name: 'treatment',
            fields: [{ name: 'is_primary_treatment', meta: { core: true } }],
          },
        ],
      });

      const record = createRecord();
      const result = await validateRecords(DEFAULT_PROGRAM_ID, [record], commonValidators);
      expectZeroValidationErrors(result);
    });

    it('[negative] should return errors when submitted schema is not valid schema', async () => {
      sinon.stub(dictionaryManager, 'instance').returns({
        // @ts-ignore
        getSchemasWithFields: () => [],
      });

      const record = createRecord({ schema: 'not_a_valid_schema' });
      const result = await validateRecords(DEFAULT_PROGRAM_ID, [record], commonValidators);

      expectToHaveNumberOfErrors(result, 2);
      expectValidationError(result[0], 1, ValidationResultType.INVALID);
    });
  });

  describe('requested core field', () => {
    it('[positive] should return successfully if core field is valid dictionary field', async () => {
      sinon.stub(dictionaryManager, 'instance').returns({
        // @ts-ignore
        getSchemasWithFields: () => [
          { name: 'treatment', fields: [{ name: 'is_primary_treatment', meta: { core: true } }] },
        ],
      });

      const record = createRecord();
      const result = await validateRecords(DEFAULT_PROGRAM_ID, [record], commonValidators);
      expectZeroValidationErrors(result);
    });

    it('[negative] should return errors if requested core field is not a valid dictionary field', async () => {
      sinon.stub(dictionaryManager, 'instance').returns({
        // @ts-ignore
        getSchemasWithFields: () => [],
      });
      const record = createRecord({ schema: 'not_a_valid_schema' });
      const result = await validateRecords(DEFAULT_PROGRAM_ID, [record], commonValidators);

      expectToHaveNumberOfErrors(result, 2);
      expectValidationError(result[0], 1, ValidationResultType.INVALID);
    });
  });

  describe('exception value', () => {
    it('[positive] should return successfully if exception value is valid', async () => {
      sinon.stub(dictionaryManager, 'instance').returns({
        // @ts-ignore
        getSchemasWithFields: () => [
          {
            name: 'treatment',
            fields: [{ name: 'is_primary_treatment', meta: { core: true } }],
          },
        ],
      });
      const record = createRecord({ requested_exception_value: ExceptionValue.NotApplicable });
      const result = await validateRecords(DEFAULT_PROGRAM_ID, [record], commonValidators);
      expectZeroValidationErrors(result);
    });

    it('[negative] should return errors if exception value is invalid', async () => {
      sinon.stub(dictionaryManager, 'instance').returns({
        // @ts-ignore
        getSchemasWithFields: () => [
          {
            name: 'treatment',
            fields: [{ name: 'is_primary_treatment', meta: { core: true } }],
          },
        ],
      });
      const record = createRecord({ requested_exception_value: 'invalid!' });
      const result = await validateRecords(DEFAULT_PROGRAM_ID, [record], commonValidators);
      expectToHaveNumberOfErrors(result, 1);
      expectValidationError(result[0], 1, ValidationResultType.INVALID);
    });
  });

  describe('duplicate rows', () => {
    it('[positive] should return successfully if there are no duplicate rows', async () => {
      sinon.stub(dictionaryManager, 'instance').returns({
        // @ts-ignore
        getSchemasWithFields: () => [
          {
            name: 'treatment',
            fields: [{ name: 'is_primary_treatment', meta: { core: true } }],
          },
        ],
      });

      const records = [
        createRecord(),
        createRecord({ requested_exception_value: ExceptionValue.NotApplicable }),
      ];
      const result = await validateRecords(DEFAULT_PROGRAM_ID, records, commonValidators);

      expectZeroValidationErrors(result);
    });

    it('[negative] should return errors if duplicate rows found', async () => {
      sinon.stub(dictionaryManager, 'instance').returns({
        // @ts-ignore
        getSchemasWithFields: () => [
          {
            name: 'treatment',
            fields: [{ name: 'is_primary_treatment', meta: { core: true } }],
          },
        ],
      });

      const records = new Array(2).fill(undefined).map(() => createRecord());
      const result = await validateRecords(DEFAULT_PROGRAM_ID, records, commonValidators);

      expectToHaveNumberOfErrors(result, 1);
      expectValidationError(result[0], 2, ValidationResultType.INVALID);
    });
  });
});
