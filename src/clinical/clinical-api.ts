import { Request, Response } from 'express';
import * as service from './clinical-service';
import { HasFullWriteAccess, ProtectTestEndpoint } from '../decorators';

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
}

export default new ClinicalController();
