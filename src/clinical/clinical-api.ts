/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { Request, Response } from 'express';
import * as service from './clinical-service';
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

    const data = await service.getClinicalData(programId);

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
