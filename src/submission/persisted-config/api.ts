/*
 * Copyright (c)  2020 The Ontario Institute for Cancer Research. All rights reserved
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

import { ControllerUtils } from '../../utils';
import { HasFullWriteAccess } from '../../decorators';
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
