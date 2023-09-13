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
import {
  convertClinicalRecordToGql,
  convertRegistrationErrorToGql,
  convertClinicalFileErrorToGql,
  convertRegistrationStatsToGql,
  RegistrationErrorData,
} from '../utils';
import { DeepReadonly } from 'deep-freeze';
import { ActiveRegistration } from '../../submission/submission-entities';
import get from 'lodash/get';

const clinicalRegistrationResolver = {
  clinicalRegistration: async (obj: unknown, args: { shortName: string }) => {
    const registration = await submissionAPI.getRegistrationDataByProgramId(args.shortName);
    return convertRegistrationDataToGql(args.shortName, {
      registration: registration,
    });
  },
};

const convertRegistrationDataToGql = (
  programShortName: string,
  data: {
    registration: DeepReadonly<ActiveRegistration> | undefined;
    errors?: RegistrationErrorData[];
    batchErrors?: { message: string; batchNames: string[]; code: string }[];
  },
) => {
  const registration = get(data, 'registration', {} as Partial<typeof data.registration>);
  const schemaAndValidationErrors = get(data, 'errors', [] as typeof data.errors);
  const fileErrors = get(data, 'batchErrors', [] as typeof data.batchErrors);
  return {
    id: registration?._id || undefined,
    programShortName,
    creator: registration?.creator || undefined,
    fileName: registration?.batchName || undefined,
    createdAt: registration?.createdAt || undefined,
    records: () =>
      get(registration, 'records')?.map((record, i) => convertClinicalRecordToGql(i, record)),
    errors: schemaAndValidationErrors?.map(convertRegistrationErrorToGql),
    fileErrors: fileErrors?.map(convertClinicalFileErrorToGql),
    newDonors: () => convertRegistrationStatsToGql(get(registration, 'stats.newDonorIds', [])),
    newSpecimens: () =>
      convertRegistrationStatsToGql(get(registration, 'stats.newSpecimenIds', [])),
    newSamples: () => convertRegistrationStatsToGql(get(registration, 'stats.newSampleIds', [])),
    alreadyRegistered: () =>
      convertRegistrationStatsToGql(get(registration, 'stats.alreadyRegistered', [])),
  };
};

export default clinicalRegistrationResolver;
