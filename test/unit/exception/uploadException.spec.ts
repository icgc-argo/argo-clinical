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
import chai from 'chai';
import { ExceptionValue } from '../../../src/exception/types';
import { validateExceptionRecords } from '../../../src/exception/exception-service';
import sinon from 'sinon';
import * as dictionaryManager from '../../../src/dictionary/manager';

const emptyFields = [
  {
    program_name: 'TEST-IE',
    schema: 'treatment',
    requested_core_field: '',
    requested_exception_value: ExceptionValue.Unknown,
  },
];

function validateError(error: any, type: any) {
  //  chai.expect(error.type).to.be.eq(type);
  chai.expect(error.message).to.be.a('string');
  chai.expect(error.message.length).to.be.greaterThan(0);
}

describe('program exception service', () => {
  it('should check for empty fields', async () => {
    const dictionaryMock = sinon
      .stub(dictionaryManager, 'instance')
      // @ts-ignore
      .returns({ getSchemasWithFields: () => ({ name: 'treatment', fields: [] }) });

    const result = await validateExceptionRecords(emptyFields[0].program_name, emptyFields);
    console.log(result);
    const res = result[0];
    chai.expect(result.length).to.be.greaterThan(0);
    chai.expect(res.row).to.eq(0);
    validateError(res, 'bb');
  });
});
