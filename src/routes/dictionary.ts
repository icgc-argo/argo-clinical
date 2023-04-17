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
import * as schemaApi from '../dictionary/api';
const router = express.Router();
// get current schema
router.get('/', wrapAsync(schemaApi.get));
router.get('/changes', wrapAsync(schemaApi.schemaController.probe));

// returns a list of all sub-schemas except sample_registration
router.get('/list', wrapAsync(schemaApi.getClinicalEntities));

// this takes precedence over /:schemaName
router.get('/template/all', wrapAsync(schemaApi.getAllTemplates));
router.get('/template/:schemaName', wrapAsync(schemaApi.getTemplate));

// dictionary migration
router.post('/migration/dry-run-update', wrapAsync(schemaApi.schemaController.dryRunUpdate));
router.post('/migration/run', wrapAsync(schemaApi.schemaController.update));
router.post('/migration/resume', wrapAsync(schemaApi.schemaController.resumeMigration));
router.get('/migration/:id', wrapAsync(schemaApi.schemaController.getMigration));
router.get('/migration/', wrapAsync(schemaApi.schemaController.getMigration));

// deprecated endpoints
router.patch('/', wrapAsync(schemaApi.schemaController.update));
router.post('/dry-run-update', wrapAsync(schemaApi.schemaController.dryRunUpdate));

export default router;
