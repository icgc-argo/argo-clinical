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

import express from 'express';
import errorHandler from 'errorhandler';
import bodyParser from 'body-parser';
import path from 'path';
import yaml from 'yamljs';
import * as swaggerUi from 'swagger-ui-express';

import { getHealth, Status } from './app-health';
import { loggerFor } from './logger';
import * as middleware from './middleware';

import dataRouter from './routes/data';
import registrationRouter from './routes/registration';
import submissionRouter from './routes/submission';
import dictionaryRouter from './routes/dictionary';
import configRouter from './routes/config';
import icgcImport from './routes/icgc-import';
import exceptionRouter from './routes/exception/exception';
import responseTime from 'response-time';
import morgan from 'morgan';
import { EgoJwtData } from '@icgc-argo/ego-token-utils/dist/common';

const L = loggerFor(__filename);

process.title = 'clinical';

// Create Express server
const app = express();

export type GlobalGqlContext = {
	isUserRequest: boolean;
	egoToken: string;
	Authorization: string;
	userJwtData: EgoJwtData | undefined;
	dataLoaders: {};
};

app.set('port', process.env.PORT || 3000);
app.set('graphqlPort', process.env.GRAPHQLPORT || 3001);
app.use(bodyParser.json());
app.use(
	morgan('dev', {
		// skip those since they get alot of traffic from monitoring
		skip: (req, res) => req.originalUrl == '/health' || req.originalUrl == '/',
	}),
);
app.use(responseTime());
app.use(
	bodyParser.urlencoded({
		extended: true,
	}),
);

/** App Custom Endpoints
 * - Ping (root w/ happy gif)
 * - Health
 * - Swagger Docs
 */
app.get('/', (req, res) => res.sendFile(path.join(__dirname, './resources/working.gif')));
app.get('/health', (req, res) => {
	const health = getHealth();
	const resBody = {
		version: `${process.env.CLINICAL_VERSION} - ${process.env.CLINICAL_COMMIT_ID}`,
		health: health,
	};
	if (health.all.status == Status.OK) {
		return res.status(200).send(resBody);
	}
	return res.status(500).send(resBody);
});
app.use(
	'/api-docs',
	swaggerUi.serve,
	swaggerUi.setup(yaml.load(path.join(__dirname, './resources/swagger.yaml'))),
);

/** Attach Routers */
app.use('/submission/configs', configRouter);
app.use('/submission/program/:programId/registration', registrationRouter);
app.use('/submission/program/:programId/clinical', submissionRouter);
app.use('/submission/icgc-import', icgcImport);

app.use('/exception', exceptionRouter);

app.use('/dictionary', dictionaryRouter);
app.use('/submission/schema', dictionaryRouter); // deprecated

app.use('/clinical', dataRouter);

// this has to be defined after all routes for it to work
app.use(middleware.errorHandler);

if (process.env.NODE_ENV !== 'PRODUCTION') {
	app.use(errorHandler());
}

export default app;
