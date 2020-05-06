import * as express from 'express';

import { wrapAsync } from '../middleware';
import * as schemaApi from '../dictionary/api';
const router = express.Router();
// get current schema
router.get('/', wrapAsync(schemaApi.get));
// update schema version api
router.patch('/', wrapAsync(schemaApi.schemaController.update));
router.post('/migration/resume', wrapAsync(schemaApi.schemaController.resumeMigration));
router.get('/migration/:id', wrapAsync(schemaApi.schemaController.getMigration));
router.get('/migration/', wrapAsync(schemaApi.schemaController.getMigration));
router.post('/dry-run-update', wrapAsync(schemaApi.schemaController.dryRunUpdate));
// schema migration api
router.get('/changes', wrapAsync(schemaApi.schemaController.probe));

// returns a list of all sub-schemas except sample_registration
router.get('/list', wrapAsync(schemaApi.getClinicalEntities));

// this takes precedence over /:schemaName
router.get('/template/all', wrapAsync(schemaApi.getAllTemplates));
// get template for a given schema
router.get('/template/:schemaName', wrapAsync(schemaApi.getTemplate));

export default router;
