import { Request, Response } from 'express';
import * as service from './clinical-service';
import { HasFullWriteAccess, ProtectTestEndpoint } from '../decorators';
import { ControllerUtils } from '../utils';

class ClinicalController {
  @HasFullWriteAccess()
  async findDonors(req: Request, res: Response) {
    return res.status(200).send(await service.getDonors(req.query.programId));
  }

  @ProtectTestEndpoint()
  @HasFullWriteAccess()
  async deleteDonors(req: Request, res: Response) {
    return res.status(200).send(await service.deleteDonors(req.query.programId));
  }

  async findDonorId(req: Request, res: Response) {
    const id = await service.findDonorId(req.query.submitterId, req.query.programId);
    return res
      .contentType('text/plain')
      .status(200)
      .send(id);
  }

  async findSpecimenId(req: Request, res: Response) {
    const id = await service.findSpecimenId(req.query.submitterId, req.query.programId);
    return res
      .contentType('text/plain')
      .status(200)
      .send(id);
  }

  async findSampleId(req: Request, res: Response) {
    const id = await service.findSampleId(req.query.submitterId, req.query.programId);
    return res
      .contentType('text/plain')
      .status(200)
      .send(id);
  }

  @HasFullWriteAccess()
  async patchDonorCompletenessStats(req: Request, res: Response) {
    const strDonorId = req.params.donorId;

    // extract number only since that's what is stored in db
    const donorId: number = Number(strDonorId.replace('DO', ''));

    if (!donorId) {
      return ControllerUtils.badRequest(res, 'Invalid/Missing donorId, e.g. DO123');
    }

    const coreCompletionOverride = req.body.coreCompletionOverride || {};

    const upadtedDonor = await service.updateDonorStats(donorId, coreCompletionOverride);

    if (!upadtedDonor) {
      return ControllerUtils.notFound(res, `Donor with donorId:${strDonorId} not found`);
    }

    return res.status(200).send(upadtedDonor);
  }
}

export default new ClinicalController();
