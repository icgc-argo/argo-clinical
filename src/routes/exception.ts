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
import multer from 'multer';
import propertyExceptionApi, {
	requestContainsFile,
} from '../exception/property-exceptions/property-exception-api';
import { wrapAsync } from '../middleware';
import featureFlags from '../feature-flags';
import { Request, Response } from 'express';
import { ExceptionErrorHandler } from '../exception/property-exceptions/error-handling';
import missingEntityExceptionApi from '../exception/missing-entity-exceptions/api';

/**
 * Property exceptions
 */
const propertyExceptionRouter = express.Router({ mergeParams: true });
const upload = multer({ dest: '/tmp' });

// Middleware
propertyExceptionRouter.use(ExceptionErrorHandler);

// GET
propertyExceptionRouter.get('/', wrapAsync(propertyExceptionApi.getProgramException));
propertyExceptionRouter.get('/entity', wrapAsync(propertyExceptionApi.getEntityException));

// POST
propertyExceptionRouter.post('*', upload.single('exceptionFile'), requestContainsFile);
propertyExceptionRouter.post('/', wrapAsync(propertyExceptionApi.createProgramException));
propertyExceptionRouter.post('/entity', wrapAsync(propertyExceptionApi.createEntityException));

// DELETE
propertyExceptionRouter.delete('/', wrapAsync(propertyExceptionApi.clearProgramException));
propertyExceptionRouter.delete(
	'/entity/:entity',
	wrapAsync(propertyExceptionApi.deleteEntityException),
);

/**
 * Missing entity exceptions
 */
const missingEntityExceptionRouter = express.Router({ mergeParams: true });

// GET
missingEntityExceptionRouter.get('/', (req, resp) => resp.send({ msg: 'not implemented yet...' }));

// POST
missingEntityExceptionRouter.post('/', missingEntityExceptionApi.createEntityException);

const notFound = (req: Request, res: Response) => res.status(404).send();

// Parent
const exceptionRouter = express.Router({ mergeParams: true });
exceptionRouter.use(
	'/property-exception',
	featureFlags.FEATURE_SUBMISSION_EXCEPTIONS_ENABLED ? propertyExceptionRouter : notFound,
);
exceptionRouter.use('/missing-entity-exception', missingEntityExceptionRouter);

export default exceptionRouter;
