import * as express from 'express';

import { wrapAsync } from '../middleware';
import submissionAPI from '../submission/submission-api';

const router = express.Router();

router.post('/lock/:lockState', wrapAsync(submissionAPI.setSubmissionLockState));

export default router;
