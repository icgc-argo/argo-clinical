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
import { DatabaseError, Result, failure, success } from '../error-handling';

const L = loggerFor(__filename);

type MissingEntityException = {
	programShortName: string;
	donorSubmitterIds: string[];
};

type MissingEntityExceptionSummary = {
	programShortName: string;
	donorCount: number;
};

const missingEntityExceptionSchema = new mongoose.Schema<MissingEntityException>({
	programShortName: String,
	donorSubmitterIds: [String],
});

// check if model exists already to account for file watchers eg. test runner with live reload
const MissingEntityExceptionModel = mongoose.model<MissingEntityException>(
	'MissingEntityException',
	missingEntityExceptionSchema,
);

/**
 * Save the provided exception. If an exception for this program exists then it will be overwritten with this value.
 * Otherwise a new MissingEntityException will be created in the database.
 *
 * A return with failure state indicates a failure communicating with the database
 * @param missingEntityException
 * @return Result that will indicate if the save happened successfully. If so, a copy of the now saved data will be returned.
 */
export const createOrUpdate = async (
	missingEntityException: MissingEntityException,
): Promise<Result<MissingEntityException>> => {
	try {
		const updatedException = await MissingEntityExceptionModel.findOneAndReplace(
			{ programShortName: missingEntityException.programShortName },
			missingEntityException,
			{ upsert: true, new: true },
		).lean(true);

		return success(updatedException);
	} catch (error) {
		L.error(
			`Failure creating or updating Missing Entity Exception for program: ${missingEntityException.programShortName}`,
			error,
		);
		return failure(`Unable to save Missing Entity Exception to database.`);
	}
};

/**
 * Will fetch Missing Entity Exception record for a given program. If there is a stored program entity exception for the donor
 * then an object will be returned with an empty list of donors.
 *
 * If this method returns a failure then an error occurred connecting to the database.
 * @param programShortName
 * @returns
 */
export const getByProgramShortName = async (
	programShortName: string,
): Promise<Result<MissingEntityException>> => {
	try {
		const exception = await MissingEntityExceptionModel.findOne({ programShortName }).lean(true);
		if (exception) {
			return success(exception);
		}
		return success({
			programShortName,
			donorSubmitterIds: [],
		});
	} catch (error) {
		L.error(`Failure reading Missing Entity Exception for program: ${programShortName}`, error);
		return failure(`Error reading data from the database.`, error);
	}
};

/**
 * Get a summary of all programs with Missing Entity Exceptions. The summary document includes a count of
 * the number of donors with exceptions for each program. To get the full list of donors with exceptions for a program
 * you can use `getByProgramShortName`.
 *
 * A failure response indicates an error communicating with the database.
 * @returns
 */
export const listAll = async (): Promise<Result<MissingEntityExceptionSummary[]>> => {
	try {
		const exceptions = await MissingEntityExceptionModel.find();
		const summaries: MissingEntityExceptionSummary[] = exceptions.map((exception) => {
			return {
				donorCount: exception.donorSubmitterIds.length,
				programShortName: exception.programShortName,
			};
		});
		return success(summaries);
	} catch (error) {
		L.error(`Failure reading Missing Entity Exceptions`, error);
		return failure(`Error reading data from the database.`, error);
	}
};
