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

import getPermissionsFromToken from '@icgc-argo/ego-token-utils/dist/index';
import canWriteSomeProgramData from '@icgc-argo/ego-token-utils/dist/index';
import { FileUpload } from 'graphql-upload';
import { GlobalGqlContext } from '../../app';
import { convertClinicalSubmissionDataToGql } from '../utils';
import submissionApi from '../../submission/submission-api';
import { AuthenticationError } from 'apollo-server-errors';

const uploadClinicalSubmissionsResolver = {
  uploadClinicalSubmissions: async (
    obj: unknown,
    args: { programShortName: string; clinicalFiles: Array<FileUpload> },
    contextValue: any,
  ) => {
    const { programShortName, clinicalFiles } = args;
    const permissionsFromToken = getPermissionsFromToken((<GlobalGqlContext>contextValue).egoToken);
    console.log('permissions from token: ' + permissionsFromToken);
    // see reason in uploadRegistration
    /* if (!canWriteSomeProgramData(permissionsFromToken)) {
    throw new AuthenticationError('User is not authorized to write data');
  }*/

    const filesMap: {
      [k: string]: ReturnType<FileUpload['createReadStream']>;
    } = {};

    await Promise.all(clinicalFiles).then(val =>
      val.forEach(file => (filesMap[file.filename] = file.createReadStream())),
    );
    const response = await submissionApi.uploadClinicalDataFromTsvFiles(
      programShortName,
      filesMap,
      (<GlobalGqlContext>contextValue).egoToken,
    );
    return convertClinicalSubmissionDataToGql(programShortName, {
      submission: response?.submission,
      batchErrors: response?.batchErrors,
      successful: response?.successful,
    });
  },
};

export default uploadClinicalSubmissionsResolver;
