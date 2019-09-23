import * as express from 'express';
import multer from 'multer';

import { wrapAsync } from '../middleware';
import submissionAPI from '../submission/submission-api';

const router = express.Router({ mergeParams: true });

const upload = multer({ dest: '/tmp' });

router.get('', wrapAsync(submissionAPI.getRegistrationByProgramId));
router.post(
  '/',
  upload.single('registrationFile'),
  wrapAsync(submissionAPI.createRegistrationWithTsv),
);
router.post('/:id/commit', wrapAsync(submissionAPI.commitRegistration));
router.delete('/:id', wrapAsync(submissionAPI.deleteRegistration));

export default router;
