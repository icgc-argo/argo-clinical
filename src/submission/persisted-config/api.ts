import { ControllerUtils } from '../../utils';
import { HasFullWriteAccess } from '../../auth-decorators';
import { Request, Response } from 'express';
import * as service from './service';

class PersistedConfigController {
  async getSubmissionDisabledState(req: Request, res: Response) {
    const submissionDisabled = await service.getSubmissionDisabledState();
    return res.status(200).send(submissionDisabled);
  }
  @HasFullWriteAccess()
  async setSubmissionDisabledState(req: Request, res: Response) {
    const { submissionDisabled } = req.body;
    if (typeof submissionDisabled !== 'boolean') {
      return ControllerUtils.badRequest(res, 'disabled can only be boolean true or false');
    }
    await service.setSubmissionDisabledState(submissionDisabled);
    return res.status(200).send({ submissionDisabled });
  }

  @HasFullWriteAccess()
  async getConfigs(req: Request, res: Response) {
    const configs = await service.getConfigs();
    return res.status(200).send(configs);
  }
}

export default new PersistedConfigController();
