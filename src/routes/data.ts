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

import * as express from 'express';

import { wrapAsync } from '../middleware';
import clinicalApi from '../clinical/clinical-api';

const router = express.Router();

// Get and Delete all
router.get('/donors', wrapAsync(clinicalApi.findDonors)); //  DEPRECATED
router.delete('/donors', wrapAsync(clinicalApi.deleteDonors)); // TEST ONLY

// Get IDs
router.get('/donors/id', wrapAsync(clinicalApi.findDonorId));
router.get('/specimens/id', wrapAsync(clinicalApi.findSpecimenId));
router.get('/samples/id', wrapAsync(clinicalApi.findSampleId));

// Get Donor Data
router.get('/program/:programId/donor/:donorId', wrapAsync(clinicalApi.getDonorById));
router.get('/program/:programId/donors', wrapAsync(clinicalApi.streamProgramDonors));
router.get('/program/:programId/submitted-data', wrapAsync(clinicalApi.getProgramClinicalData));

// Get TSV Data
router.get(
  '/program/:programId/tsv-export',
  wrapAsync(clinicalApi.getProgramClinicalDataAsTsvsInZip),
); // DEPRECATED
router.get('/program/:programId/tsv/all', wrapAsync(clinicalApi.getProgramClinicalDataAsTsvsInZip));
router.get(
  '/program/:programId/tsv/:entityType',
  wrapAsync(clinicalApi.getProgramClinicalDataAsTsv),
);

router.patch('/donor/:donorId/completion-stats', wrapAsync(clinicalApi.patchDonorCompletionStats));

export default router;
