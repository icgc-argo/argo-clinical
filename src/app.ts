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
import schemaRouter from './routes/schema';
import configRouter from './routes/config';
import icgcImport from './routes/icgc-import';
import responseTime from 'response-time';
import morgan from 'morgan';

const L = loggerFor(__filename);

process.title = 'clinical';

// Create Express server
const app = express();
app.set('port', process.env.PORT || 3000);
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
app.use('/submission/schema', schemaRouter);
app.use('/submission/icgc-import', icgcImport);

app.use('/clinical', dataRouter);

// this has to be defined after all routes for it to work
app.use(middleware.errorHandler);

if (process.env.NODE_ENV !== 'PRODUCTION') {
  app.use(errorHandler());
}

export default app;
