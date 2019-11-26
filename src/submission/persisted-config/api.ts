import { ControllerUtils } from '../../utils';
import { HasFullWriteAccess } from '../../auth-decorators';
import { Request, Response } from 'express';
import * as persistedConfig from './service';

class AdminController {
  // no auth check because temporary hack
  async replacePersistedConfig(req: Request, res: Response) {
    const newConfiguration = req.body;
    const result = await persistedConfig.operations.updatePersistedConifig(newConfiguration);
    return res.status(200).send(result);
  }

  @HasFullWriteAccess()
  async setSubmissionDisableState(req: Request, res: Response) {
    const { setDisabled } = req.query;
    if (!Boolean(setDisabled)) {
      return ControllerUtils.badRequest(res, 'setDisabled can only be true or false');
    }
    const disabled = await persistedConfig.operations.setSubmissionDisabledState(setDisabled);
    return res
      .status(200)
      .send(`Sample registration and clinical submission system: disabled=${disabled}`);
  }
  @HasFullWriteAccess()
  async getSubmissionDisableState(req: Request, res: Response) {
    const disabled = await persistedConfig.operations.getSubmissionDisabledState();
    return res
      .status(200)
      .send(`Sample registration and clinical submission system: disabled=${disabled}`);
  }
}

export default new AdminController();
