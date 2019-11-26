import { ControllerUtils } from '../utils';
import { HasFullWriteAccess } from '../auth-decorators';
import { Request, Response } from 'express';
import * as admin from './service';

class AdminController {
  // temporary hack
  async loadDefault(req: Request, res: Response) {
    return res.status(200).send(await admin.operations.loadDefaultPersistedConfig());
  }
  async replace(req: Request, res: Response) {
    const newConfiguration = req.body;
    const result = await admin.operations.setConifugration(newConfiguration);
    return res.status(200).send(result);
  }

  // @HasFullWriteAccess()
  async setSubmissionLockState(req: Request, res: Response) {
    const { setLock } = req.query;
    if (
      setLock.toString().toLowerCase() !== 'true' &&
      setLock.toString().toLowerCase() !== 'false'
    ) {
      return ControllerUtils.badRequest(res, 'Lock can only be true or false');
    }
    await admin.operations.setSubmissionLock(setLock);
    return res.status(200).send(`Sample registration and submissions: locked=${setLock}`);
  }
  // @HasFullWriteAccess()
  async getSubmissionLockState(req: Request, res: Response) {
    const lockState = await admin.operations.getSubmissionLockStatus();
    return res.status(200).send(`Sample registration and submissions: locked=${lockState}`);
  }
}

export default new AdminController();
