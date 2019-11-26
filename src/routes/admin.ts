import * as express from 'express';

import { wrapAsync } from '../middleware';
import adminAPI from '../admin/api';

const router = express.Router();

router.get('/submission/lock', wrapAsync(adminAPI.getSubmissionLockState));
router.post('/submission/lock', wrapAsync(adminAPI.setSubmissionLockState));

// hacks - for dev purpose
router.post('/persistedConfig/replace', wrapAsync(adminAPI.replacePersistedConfig));

export default router;
