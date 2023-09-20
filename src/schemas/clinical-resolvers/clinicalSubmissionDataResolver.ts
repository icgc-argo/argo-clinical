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

import submissionAPI from '../../submission/submission-api';
import configAPI from '../../submission/persisted-config/api';
import * as schemaApi from '../../dictionary/api';
import { convertClinicalSubmissionDataToGql } from '../utils';

const clinicalSubmissions = async (obj: unknown, args: { programShortName: string }) => {
  const { programShortName } = args;

  const submissionData = await submissionAPI.getActiveSubmissionDataByProgramId(programShortName);
  return convertClinicalSubmissionDataToGql(programShortName, {
    submission: submissionData,
  });
};

export const clinicalSubmissionTypesList = async (
  obj: unknown,
  args: { includeFields: string },
) => {
  const withFields = args?.includeFields?.toLowerCase() === 'true';
  const schemas = await schemaApi.getClinicalSchemas(withFields);

  return schemas;
};

// export const clinicalSubmissionSchemaVersion = async (obj: unknown, args: {}) => {
//   return await schemaApi.get();
// };

// export const clinicalSubmissionSystemDisabled = async (obj: unknown, args: {}) => {
//   return await configAPI.getSubmissionDisabledState();
// };

export default clinicalSubmissions;
