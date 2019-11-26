import * as express from 'express';

import { wrapAsync } from '../middleware';
import configAPI from '../submission/persisted-config/api';

const router = express.Router();

router.get('/submissionDisabled', wrapAsync(configAPI.getSubmissionDisableState));
router.post('/submissionDisabled', wrapAsync(configAPI.setSubmissionDisableState));

// hacks - for dev purpose
router.post('/replace', wrapAsync(configAPI.replacePersistedConfig));

export default router;
