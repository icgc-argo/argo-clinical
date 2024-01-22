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

import { HasFullWriteAccess } from '../../decorators';
import { Request, Response } from 'express';
import { createOrUpdate } from './repo';

const parseBoolString = (queryString: string) => {
	if (queryString) {
		return queryString.toLowerCase() === 'true' || false;
	} else {
		return false;
	}
};

class MissingEntityExceptionController {
	// @HasFullWriteAccess()
	async createEntityException(req: Request, res: Response) {
		const programId = req.params.programId;
		const donorSubmitterIds = req.body.donorSubmitterIds;
		const isDryRun = parseBoolString(req.query['dry-run']);

		const result = await createOrUpdate({
			programId,
			donorSubmitterIds,
			isDryRun,
		});

		const status = result.success ? 201 : 422;
		return res.status(status).send({ programId, donorSubmitterIds, isDryRun });
	}
}

export default new MissingEntityExceptionController();
