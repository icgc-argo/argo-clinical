import * as express from 'express';
import multer from 'multer';
import { wrapAsync } from '../middleware';
import submissionAPI from '../submission/submission-api';

const router = express.Router({ mergeParams: true });
const upload = multer({ dest: '/tmp' });

router.post(
  '/preprocess/:programId',
  upload.single('samples'),
  wrapAsync(submissionAPI.processLegacyIcgcData),
);

router.post('/', upload.single('donors'), wrapAsync(submissionAPI.addDonors));

export default router;
