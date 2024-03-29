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

import * as express from 'express';

import { wrapAsync } from '../middleware';
import clinicalApi from '../clinical/api/clinical-api';

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
router.post(
	'/program/:programId/clinical-data',
	wrapAsync(clinicalApi.getProgramClinicalEntityData),
);
router.post(
	'/program/:programId/clinical-search-results',
	wrapAsync(clinicalApi.getProgramClinicalSearchResults),
);
router.post('/program/:programId/clinical-errors', wrapAsync(clinicalApi.getProgramClinicalErrors));
router.post(
	'/program/:programId/clinical-tsv',
	wrapAsync(clinicalApi.getSpecificClinicalDataAsTsvsInZip),
);

// Download TSVs for Donors by Donor ID
router.post('/donors/tsv', wrapAsync(clinicalApi.getDonorDataByIdAsTsvsInZip));

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

export default router;
