import * as express from 'express';
import multer from 'multer';
import { wrapAsync } from '../middleware';
import submissionAPI from '../submission/submission-api';

const router = express.Router({ mergeParams: true });
const upload = multer({ dest: '/tmp' });

router.post(
  '/preprocess/:programId',
  upload.fields([{ name: 'donor' }, { name: 'specimen' }, { name: 'sample' }]),
  wrapAsync(submissionAPI.processLegacyIcgcData),
);

router.post('/', wrapAsync(submissionAPI.addDonors));

export default router;
