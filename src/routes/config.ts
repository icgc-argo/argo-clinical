import * as express from 'express';

import { wrapAsync } from '../middleware';
import configAPI from '../submission/persisted-config/api';

const router = express.Router();

router.get('/', wrapAsync(configAPI.getConfigs));
router.patch('/submission-disabled', wrapAsync(configAPI.setSubmissionDisabledState));

export default router;
