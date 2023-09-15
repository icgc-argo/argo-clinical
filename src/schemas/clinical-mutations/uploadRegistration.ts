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

import { FileUpload } from 'graphql-upload';
import { GlobalGqlContext } from '../../app';
import submissionAPI from '../../submission/submission-api';
import { convertRegistrationDataToGql } from '../utils';

const uploadClinicalRegistration = {
  uploadClinicalRegistration: async (
    obj: unknown,
    args: {
      shortName: string;
      registrationFile: FileUpload;
    },
    context: GlobalGqlContext,
  ) => {
    const { Authorization, egoToken } = context;
    const { shortName, registrationFile } = args;

    const permissions = egoTokenUtils.getPermissionsFromToken(egoToken);
    // Here we are confirming that the user has at least some ability to write Program Data
    // This is to reduce the opportunity for spamming the gateway with file uploads
    if (!egoTokenUtils.canWriteSomeProgramData(permissions)) {
      throw new AuthenticationError('User is not authorized to write data');
    }

    const { filename, createReadStream } = await registrationFile;
    const fileStream = createReadStream();

    const formData = new FormData();

    // Need to buffer whole file from stream to ensure it all gets added to form data.
    const fileBuffer = fileStream;

    // For FormData to send a buffer as a file, it requires a filename in the options.
    formData.append('registrationFile', fileBuffer, filename);

    // req: Request, res: Response
    const response = await submissionAPI.uploadClinicalTsvFiles(
      shortName,
      filename,
      fileStream,
      Authorization,
    );

    // return convertRegistrationDataToGql(shortName, response);
  },
};
