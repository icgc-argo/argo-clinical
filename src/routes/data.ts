import * as express from 'express';

import { wrapAsync } from '../middleware';
import clinicalApi from '../clinical/clinical-api';

const router = express.Router();

router.get('/donors', wrapAsync(clinicalApi.findDonors));
router.delete('/donors', wrapAsync(clinicalApi.deleteDonors));
router.get('/donors/id', wrapAsync(clinicalApi.findDonorId));
router.get('/specimens/id', wrapAsync(clinicalApi.findSpecimenId));
router.get('/samples/id', wrapAsync(clinicalApi.findSampleId));

router.get(
  '/program/:programId/tsv-export',
  wrapAsync(clinicalApi.getProgramClinicalDataAsTsvsInZip),
);

router.patch('/donor/:donorId/completion-stats', wrapAsync(clinicalApi.patchDonorCompletionStats));

export default router;
