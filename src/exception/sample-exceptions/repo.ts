/*
 * Copyright (c) 2025 The Ontario Institute for Cancer Research. All rights reserved
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

import { loggerFor } from '../../logger';
import { failure, success } from '../../utils/results';
import { SAMPLE_EXCEPTION_KEY, SampleException } from './model';

const L = loggerFor(__filename);

/**
 * Single exception object to hold array of program id exceptions
 */
const sampleExceptionExceptionSchema = new mongoose.Schema<SampleException>({
	key: String,
	programIds: [String],
});

// check if model exists already to account for file watchers eg. test runner with live reload
const SampleExceptionModel = mongoose.model<SampleException>(
	'SampleException',
	sampleExceptionExceptionSchema,
);

export const getExceptions = async () => {
	try {
		const exception = await SampleExceptionModel.findOne({
			key: SAMPLE_EXCEPTION_KEY,
		}).lean(true);

		return success(exception === null ? [] : exception.programIds);
	} catch (error) {
		L.error(`Failure reading Missing Entity Exception for program`, error);
		return failure(`Error reading data from the database.`, error);
	}
};

/**
 * @param programIds - programIds for exceptions
 */
export const createOrUpdate = async (programIds: string[]) => {
	try {
		const updatedException = await SampleExceptionModel.findOneAndReplace(
			{ key: SAMPLE_EXCEPTION_KEY },
			{ key: SAMPLE_EXCEPTION_KEY, programIds },
			{ upsert: true, new: true },
		).lean(true);

		return success(updatedException);
	} catch (error) {
		L.error(`Failure creating or updating Sample Exception`, error);
		return failure(`Unable to save Sample Entity Exception to database.`);
	}
};
