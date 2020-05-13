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
