import * as express from 'express';

import { wrapAsync } from '../middleware';
import * as schemaApi from '../submission/schema-api';

const router = express.Router();

router.get('/', wrapAsync(schemaApi.get));
router.get('/all', wrapAsync(schemaApi.getAllSchema));
// get template for a given schema
router.get('/template/:schemaName', wrapAsync(schemaApi.getTemplate));
// temporary api
router.post('/hack/refresh', wrapAsync(schemaApi.update));
router.post('/hack/replace', wrapAsync(schemaApi.replace));

export default router;
