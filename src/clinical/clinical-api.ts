import { Request, Response } from 'express';
import * as service from './clinical-service';
import * as nonBlockingFunctions from './nonblocking';
import { HasFullWriteAccess, ProtectTestEndpoint, HasProgramWriteAccess } from '../decorators';
import { ControllerUtils, TsvUtils } from '../utils';
import AdmZip from 'adm-zip';

class ClinicalController {
  @HasFullWriteAccess()
  async findDonors(req: Request, res: Response) {
    return res.status(200).send(await service.getDonors(req.query.programId));
  }

  @HasProgramWriteAccess((req: Request) => req.params.programId)
  async getProgramClinicalDataAsTsvsInZip(req: Request, res: Response) {
    const programId = req.params.programId;
    if (!programId) {
      return ControllerUtils.badRequest(res, 'Invalid programId provided');
    }

    const data = await nonBlockingFunctions.getClinicalData(programId);

    const todaysDate = currentDateFormatted();
    res
      .status(200)
      .contentType('application/zip')
      .attachment(`${programId}_Clinical_Data_${todaysDate}.zip`);

    const zip = new AdmZip();
    data.forEach((d: any) => {
      const tsvData = TsvUtils.convertJsonRecordsToTsv(d.records, d.entityFields);
      zip.addFile(`${d.entityName}.tsv`, Buffer.alloc(tsvData.length, tsvData));
    });

    res.send(zip.toBuffer());
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
  async patchDonorCompletionStats(req: Request, res: Response) {
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

function currentDateFormatted() {
  const now = new Date();
  return `${now.getFullYear()}${now.getMonth()}${now.getDate()}`;
}

export default new ClinicalController();
