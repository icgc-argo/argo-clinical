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
import 'deep-equal-in-any-order';
import { TsvUtils } from '../../../src/utils';

chai.use(require('deep-equal-in-any-order'));

describe('tsv-utils', () => {
	const baseJsoncontent = { header1: 'TEST' };
	const arrayDelim = TsvUtils.ARRAY_DELIMITER_CHAR;

	describe('tsv-parser', () => {
		it('should parse value with arrayDelimiterChar into arrays', () => {
			// some example values after exported out of excel
			const content = ` \
         header1\theader2 \n \
         TEST\tChemo ${arrayDelim} Radiation \n \
         TEST\tHormone${arrayDelim}Surgery
         `;
			const jsonContent = TsvUtils.parseTsvToJson(content);

			const expectedJsonContent = [
				{ ...baseJsoncontent, header2: ['Chemo', 'Radiation'] },
				{ ...baseJsoncontent, header2: ['Hormone', 'Surgery'] },
			];

			chai.expect(jsonContent).to.deep.equalInAnyOrder(expectedJsonContent);
		});

		it('should remove qouble quotes for excel compatibility', () => {
			// some example values after exported out of excel
			const content = ` \
         header1\theader2 \n \
         TEST\t"Chemo ${arrayDelim} Radiation" \n \
         TEST\t"Methylcellulose ""450"" 500 mg oral tablet" \n \
         TEST\t"transparent dressing 4 3/8"" X 5"" TOPICAL BANDAGE" \n \
         TEST\t"Health Care America Insulin Syringe 29gx1/2"""
        `;
			const jsonContent = TsvUtils.parseTsvToJson(content);

			const expectedJsonContent = [
				{ ...baseJsoncontent, header2: ['Chemo', 'Radiation'] },
				{ ...baseJsoncontent, header2: 'Methylcellulose "450" 500 mg oral tablet' },
				{ ...baseJsoncontent, header2: 'transparent dressing 4 3/8" X 5" TOPICAL BANDAGE' },
				{ ...baseJsoncontent, header2: 'Health Care America Insulin Syringe 29gx1/2"' },
			];

			chai.expect(jsonContent).to.deep.equalInAnyOrder(expectedJsonContent);
		});
	});
});
