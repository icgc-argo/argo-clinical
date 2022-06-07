/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
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

import * as donor from './donor';
import * as specimen from './specimen';
import * as follow_up from './followUp';
import * as treatment from './treatment';
import * as therapy from './therapy';
import * as biomarker from './biomarker';
import * as surgery from './surgery';
import { ClinicalEntitySchemaNames } from '../../common-model/entities';
import * as primaryDiagnosis from './primaryDiagnosis';

// this done because typescript doesn't allow mapping with string index signature for default export
const availableValidators: { [k: string]: any } = {
  [ClinicalEntitySchemaNames.DONOR]: donor,
  [ClinicalEntitySchemaNames.SPECIMEN]: specimen,
  [ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]: primaryDiagnosis,
  [ClinicalEntitySchemaNames.FOLLOW_UP]: follow_up,
  [ClinicalEntitySchemaNames.TREATMENT]: treatment,
  [ClinicalEntitySchemaNames.BIOMARKER]: biomarker,
  // all therapies follow the same validation
  [ClinicalEntitySchemaNames.CHEMOTHERAPY]: therapy,
  [ClinicalEntitySchemaNames.RADIATION]: therapy,
  [ClinicalEntitySchemaNames.HORMONE_THERAPY]: therapy,
  [ClinicalEntitySchemaNames.IMMUNOTHERAPY]: therapy,
  [ClinicalEntitySchemaNames.SURGERY]: surgery,
};

export const submissionValidator = (clinicalType: string): any => {
  const validator = availableValidators[clinicalType];
  if (!validator) {
    // return a dummy validator if one doesn't exist
    return { validate: () => ({ errors: [], warnings: [] }) };
  }
  return validator;
};
