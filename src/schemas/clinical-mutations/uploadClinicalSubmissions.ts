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

import { convertClinicalSubmissionDataToGql } from '../utils';
import submissionApi from '../../submission/submission-api';
import { AuthenticationError } from 'apollo-server-errors';
import { Request, Response } from 'express';
import egoTokenUtils from '../../egoTokenUtils';

async function uploadClinicalSubmissions(req: Request, res: Response) {
  const programShortName = req.params.programId;
  const clinicalFiles = req.files as Express.Multer.File[];

  const egoToken = (req.headers.authorization || '').split('Bearer ').join('');
  const permissionsFromToken = egoTokenUtils.getPermissionsFromToken(egoToken);

  /*if (!egoTokenUtils.canWriteSomeProgramData(permissionsFromToken)) {
    throw new AuthenticationError('User is not authorized to write data');
  }*/

  const uploadResult = await submissionApi.uploadClinicalDataFromTsvFiles(
    programShortName,
    clinicalFiles,
    egoToken,
  );

  let status = 200;
  if (!uploadResult?.successful || uploadResult.batchErrors.length > 0) {
    status = 207;
  }

  const response = await convertClinicalSubmissionDataToGql(programShortName, {
    submission: uploadResult?.submission,
    batchErrors: uploadResult?.batchErrors,
    successful: uploadResult?.successful,
  });

  return res.status(status).send(response);
}

export default uploadClinicalSubmissions;
