import * as express from 'express';

import { wrapAsync } from '../middleware';
import adminAPI from '../admin/api';

const router = express.Router();

router.get('/submission/disable', wrapAsync(adminAPI.getSubmissionDisableState));
router.post('/submission/disable', wrapAsync(adminAPI.setSubmissionDisableState));

// hacks - for dev purpose
router.post('/persistedConfig/replace', wrapAsync(adminAPI.replacePersistedConfig));

export default router;
