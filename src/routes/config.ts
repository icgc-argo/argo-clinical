import * as express from 'express';

import { wrapAsync } from '../middleware';
import configAPI from '../submission/persisted-config/api';

const router = express.Router();

router.get('/submissionDisabled', wrapAsync(configAPI.getSubmissionDisabledState));
router.patch('/submissionDisabled', wrapAsync(configAPI.setSubmissionDisabledState));

// hacks - for dev purpose
router.patch('/replace', wrapAsync(configAPI.replacePersistedConfig));

export default router;
