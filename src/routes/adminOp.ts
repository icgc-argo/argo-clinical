import * as express from 'express';

import { wrapAsync } from '../middleware';
import submissionAPI from '../submission/submission-api';

const router = express.Router({ mergeParams: true });

router.post(
  '/recalculate-stats/:programId/:submitterDonorId',
  wrapAsync(submissionAPI.overrideDonorStats),
);

export default router;
