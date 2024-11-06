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
import mongoose from 'mongoose';
import { loggerFor } from '../../../logger';
import { DatabaseError } from '../error-handling';
import { ExceptionValue, ProgramException } from '../types';

const L = loggerFor(__filename);

const programExceptionSchema = new mongoose.Schema<ProgramException>({
	programId: String,
	exceptions: [
		{
			program_name: String,
			schema: String,
			requested_core_field: String,
			requested_exception_value: { type: String, enum: Object.values(ExceptionValue) },
		},
	],
});

// check if model exists already to account for file watchers eg. test runner with live reload
const ProgramExceptionModel =
	mongoose.models.ProgramException ||
	mongoose.model<ProgramException>('ProgramException', programExceptionSchema);

type OptionalSearchParams = {
	exceptions: Partial<{
		requested_core_field: string;
	}>;
};

const programExceptionRepository = {
	async save(exception: ProgramException): Promise<ProgramException> {
		L.debug(`Creating new program exception with: ${JSON.stringify(exception)}`);
		try {
			const doc = await ProgramExceptionModel.findOneAndUpdate(
				{ programId: exception.programId },
				exception,
				{ upsert: true, new: true, overwrite: true },
			).lean(true);
			L.info(`doc created ${JSON.stringify(doc)}`);

			return doc;
		} catch (e) {
			L.error('failed to create program exception: ', e);
			throw new DatabaseError('Cannot save program exception.');
		}
	},

	async find(
		programId: string,
		optionalSearchParams?: OptionalSearchParams,
	): Promise<ProgramException | null> {
		L.debug(`finding program exception with id: ${JSON.stringify(programId)}`);
		try {
			const searchParams = {
				programId,
			};
			if (optionalSearchParams?.exceptions.requested_core_field) {
				searchParams['exceptions.requested_core_field'] =
					optionalSearchParams?.exceptions.requested_core_field;
			}
			const doc = await ProgramExceptionModel.findOne(searchParams).lean(true);
			return doc;
		} catch (e) {
			L.error('failed to find program exception', e);
			throw new DatabaseError('Cannot find program exception.');
		}
	},

	async delete(programId: string): Promise<ProgramException | null> {
		L.debug(`deleting program exception with program id: ${JSON.stringify(programId)}`);
		try {
			const doc = await ProgramExceptionModel.findOneAndDelete({ programId }).lean(true);
			return doc;
		} catch (e) {
			L.error('failed to delete program exception', e);
			throw new DatabaseError('Cannot delete program exception.');
		}
	},
};

export default programExceptionRepository;
