import * as express from 'express';

import { wrapAsync } from '../middleware';
import * as schemaApi from '../submission/schema-api';

const router = express.Router();

router.get('/', wrapAsync(schemaApi.get));
// returns a list of all sub-schemas except sample_registration
router.get('/list', wrapAsync(schemaApi.getAllSchemas));
// this takes precedence over /:schemaName
router.get('/template/all', wrapAsync(schemaApi.getAllTemplates));
// get template for a given schema
router.get('/template/:schemaName', wrapAsync(schemaApi.getTemplate));
// temporary api
router.post('/hack/refresh', wrapAsync(schemaApi.update));
router.post('/hack/replace', wrapAsync(schemaApi.replace));

export default router;
