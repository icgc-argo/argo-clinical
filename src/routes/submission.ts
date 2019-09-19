import * as express from 'express';
import multer from 'multer';

import { wrapAsync } from '../middleware';
import submissionAPI from '../submission/submission-api';

const router = express.Router({ mergeParams: true });

const upload = multer({ dest: '/tmp' });

router.get('/upload', wrapAsync(submissionAPI.getActiveSubmissionByProgramId));
router.post(
  '/upload',
  upload.array('clinicalFiles'),
  wrapAsync(submissionAPI.saveClinicalTsvFiles),
);
router.post('/validate/:versionId', wrapAsync(submissionAPI.validateActiveSubmission));

export default router;
