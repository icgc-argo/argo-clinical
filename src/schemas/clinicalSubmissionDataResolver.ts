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

import submissionAPI from '../submission/submission-api';
import get from 'lodash/get';
import { ActiveClinicalSubmission } from '../submission/submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { convertClinicalFileErrorToGql, convertClinicalSubmissionEntityToGql } from './utils';
import { getClinicalEntitiesData } from '../dictionary/api';

const clinicalSubmissionResolver = {
  Query: {
    clinicalSubmissions: async (obj: unknown, args: { programShortName: string }) => {
      const { programShortName } = args;

      const submissionData = await submissionAPI.getActiveSubmissionDataByProgramId(
        programShortName,
      );
      return convertClinicalSubmissionDataToGql(programShortName, {
        submission: submissionData,
      });
    },
  },
};

const convertClinicalSubmissionDataToGql = (
  programShortName: string,
  data: {
    submission: DeepReadonly<ActiveClinicalSubmission> | undefined;
    batchErrors?: { message: string; batchNames: string[]; code: string }[];
  },
) => {
  const submission = get(data, 'submission', {} as Partial<typeof data.submission>);
  const fileErrors = get(data, 'batchErrors', [] as typeof data.batchErrors);
  const clinicalEntities = get(submission, 'clinicalEntities');
  return {
    id: submission?._id || undefined,
    programShortName,
    state: submission?.state || undefined,
    version: submission?.version || undefined,
    updatedBy: submission?.updatedBy || undefined,
    updatedAt: submission?.updatedAt ? submission.updatedAt : undefined,
    clinicalEntities: async () => {
      const clinicalSubmissionTypeList = await getClinicalEntitiesData('false'); // to confirm for true or false
      const filledClinicalEntities = clinicalSubmissionTypeList.map(clinicalType => ({
        clinicalType,
        ...(clinicalEntities ? clinicalEntities[clinicalType.name] : {}),
      }));
      return filledClinicalEntities.map(clinicalEntity =>
        convertClinicalSubmissionEntityToGql(clinicalEntity?.clinicalType.name, clinicalEntity),
      );
    },
    fileErrors: fileErrors?.map(convertClinicalFileErrorToGql),
  };
};

export default clinicalSubmissionResolver;
