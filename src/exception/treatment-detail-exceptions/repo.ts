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
import { loggerFor } from '../../logger';
import { Result, failure, success } from '../../utils/results';
import { TreatmentDetailException, TreatmentDetailExceptionSummary } from './model';

const L = loggerFor(__filename);

const treatmentDetailExceptionSchema = new mongoose.Schema<TreatmentDetailException>({
	programId: String,
	donorSubmitterIds: [String],
});

// check if model exists already to account for file watchers eg. test runner with live reload
const TreatmentDetailExceptionModel = mongoose.model<TreatmentDetailException>(
	'TreatmentDetailException',
	treatmentDetailExceptionSchema,
);

/**
 * Save the provided exception. If an exception for this program exists then it will be overwritten with this value.
 * Otherwise a new TreatmentDetailException will be created in the database.
 *
 * A return with failure state indicates a failure communicating with the database
 * @param treatmentDetailExceptionException
 * @return Result that will indicate if the save happened successfully. If so, a copy of the now saved data will be returned.
 */
export const createOrUpdate = async (
	treatmentDetailException: TreatmentDetailException,
): Promise<Result<TreatmentDetailException>> => {
	try {
		const updatedException = await TreatmentDetailExceptionModel.findOneAndReplace(
			{ programId: treatmentDetailException.programId },
			treatmentDetailException,
			{ upsert: true, new: true },
		).lean(true);

		return success(updatedException);
	} catch (error) {
		L.error(
			`Failure creating or updating Treatment Detail Exception for program: ${treatmentDetailException.programId}`,
			error,
		);
		return failure(`Unable to save Treatment Detail Exception to database.`);
	}
};

/**
 * Will fetch Treatment Detail Exception record for a given program. If there is a stored program Treatment exception for the donor
 * then an object will be returned with an empty list of donors.
 *
 * If this method returns a failure then an error occurred connecting to the database.
 * @param programId
 * @returns
 */
export const getByProgramId = async (
	programId: string,
): Promise<Result<TreatmentDetailException>> => {
	try {
		const exception = await TreatmentDetailExceptionModel.findOne({
			programId: programId,
		}).lean(true);
		if (exception) {
			return success(exception);
		}
		return success({
			programId,
			donorSubmitterIds: [],
		});
	} catch (error) {
		L.error(`Failure reading Treatment Detail Exception for program: ${programId}`, error);
		return failure(`Error reading data from the database.`, error);
	}
};

/**
 * Get a summary of all programs with Treatment Detail Exceptions. The summary document includes a count of
 * the number of donors with exceptions for each program. To get the full list of donors with exceptions for a program
 * you can use `getByProgramShortName`.
 *
 * A failure response indicates an error communicating with the database.
 * @returns
 */
export const listAll = async (): Promise<Result<TreatmentDetailExceptionSummary[]>> => {
	try {
		const exceptions = await TreatmentDetailExceptionModel.find();
		const summaries: TreatmentDetailExceptionSummary[] = exceptions.map((exception) => {
			return {
				donorCount: exception.donorSubmitterIds.length,
				programId: exception.programId,
			};
		});
		return success(summaries);
	} catch (error) {
		L.error(`Failure reading Treatment Detail Exceptions`, error);
		return failure(`Error reading data from the database.`, error);
	}
};
