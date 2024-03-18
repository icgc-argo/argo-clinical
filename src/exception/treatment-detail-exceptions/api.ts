/*
 * Copyright (c) 2024 The Ontario Institute for Cancer Research. All rights reserved
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

import { HasFullReadAccess, HasFullWriteAccess } from '../../decorators';
import { Request, Response } from 'express';
import { parseBoolString } from '../../utils/request';
import * as service from './service';
import { z as zod } from 'zod';
import { getByProgramId, listAll } from './repo';

const updateRequestBody = zod.object({ donorSubmitterIds: zod.string().array() });

class TreatmentDetailExceptionController {
	@HasFullReadAccess()
	async getTreatmentDetailException(req: Request, res: Response) {
		const result = await getByProgramId(req.params.programId);
		if (!result.success) {
			const { message, errors } = result;
			return res.status(500).send({ message, errors });
		} else {
			return res.status(200).send(result.data);
		}
	}

	@HasFullReadAccess()
	async listTreatmentDetailExceptions(req: Request, res: Response) {
		const result = await listAll();
		if (!result.success) {
			const { message, errors } = result;
			return res.status(500).send({ message, errors });
		} else {
			return res.status(200).send(result.data);
		}
	}

	@HasFullWriteAccess()
	async createTreatmentDetailException(req: Request, res: Response) {
		const programId = req.params.programId;
		const isDryRun = parseBoolString(req.query['dry-run']);

		// Validate
		const validateBodyResult = updateRequestBody.safeParse(req.body);
		if (!validateBodyResult.success) {
			return res.status(400).send({
				message: 'Failed to validate request body for donor submitter ids.',
				errors: validateBodyResult.error,
			});
		}

		const result = await service.create({
			programId,
			newDonorIds: validateBodyResult.data.donorSubmitterIds,
			isDryRun,
		});

		if (!result.success) {
			const { message, errors } = result;
			return res.status(500).send({ message, errors });
		} else {
			return res.status(200).send(result.data);
		}
	}
}

export default new TreatmentDetailExceptionController();
