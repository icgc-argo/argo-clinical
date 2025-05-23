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
import {
	BaseEntityExceptionRecord,
	Entity,
	EntityException,
	EntityExceptionRecord,
	ExceptionValue,
} from '../types';
import { ClinicalEntitySchemaNames } from '../../../common-model/entities';

const L = loggerFor(__filename);

const BaseExceptionSchema = {
	program_name: String,
	schema: String,
	submitter_donor_id: String,
	requested_core_field: String,
	requested_exception_value: { type: String, enum: Object.values(ExceptionValue) },
};

const entityExceptionSchema = new mongoose.Schema<EntityException>({
	programId: String,
	follow_up: [
		{
			...BaseExceptionSchema,
			submitter_follow_up_id: String,
		},
	],
	specimen: [
		{
			...BaseExceptionSchema,
			submitter_specimen_id: String,
		},
	],
	treatment: [
		{
			...BaseExceptionSchema,
			submitter_treatment_id: String,
		},
	],
});

// check if model exists already to account for file watchers eg. test runner with live reload
const EntityExceptionModel =
	mongoose.models.EntityException ||
	mongoose.model<EntityException>('EntityException', entityExceptionSchema);

const entityExceptionRepository = {
	/**
	 * Create or Update the entity exceptions for this program, setting the exceptions for the specified entity to the list of records provided.
	 * @param programId
	 * @param records
	 * @param entity
	 * @returns
	 */
	async save(
		programId: string,
		records: ReadonlyArray<EntityExceptionRecord>,
		entity: ClinicalEntitySchemaNames,
	): Promise<EntityException> {
		// Get the stored entity exceptions for the program. We will replace the records for the entity type specified in the funciton arguments.
		const existingExceptions = await entityExceptionRepository.find(programId);

		const entities: Record<Entity, typeof records> = {
			follow_up: existingExceptions?.follow_up || [],
			treatment: existingExceptions?.treatment || [],
			specimen: existingExceptions?.specimen || [],
		};

		const update = { ...entities, [entity]: records };

		L.debug(`Creating new donor exception for program: ${programId}, entity: ${entity}`);

		try {
			const doc = await EntityExceptionModel.findOneAndUpdate({ programId }, update, {
				upsert: true,
				new: true,
				returnDocument: 'after',
			}).lean(true);
			return doc;
		} catch (e) {
			L.error('Failed to create entity exception: ', e);
			throw new DatabaseError('Cannot save entity exception.');
		}
	},

	async find(
		programId: string,
		optionalSearchParams?: Record<string, string>,
	): Promise<EntityException | null> {
		L.debug(`Finding entity exception with program id: ${JSON.stringify(programId)}`);
		try {
			const searchParams = {
				programId,
				...optionalSearchParams,
			};

			// first found document, or null
			const doc = await EntityExceptionModel.findOne(searchParams).lean(true);
			return doc;
		} catch (e) {
			L.error('Failed to find program exception', e);
			throw new DatabaseError('Cannot find entity exception.');
		}
	},

	async deleteSingleEntity(
		programId: string,
		entity: Entity,
		submitterDonorIds: string[],
	): Promise<EntityException | null> {
		L.debug(
			`Deleting single entity ${entity} exception with program id: ${JSON.stringify(programId)}`,
		);
		try {
			const entityExceptionDoc = await EntityExceptionModel.findOne({ programId });
			if (entityExceptionDoc) {
				/**
				 * typescript union array methods don't work well particulary pre v4 (currently on 3.9.5)
				 * all our entity types union with BaseEntityExceptionRecord
				 * filter only uses the `submitter_donor_id` field which is in BaseEntityExceptionRecord
				 * explicitly adding `any` typings so it's very obvious we loose type data here
				 */
				const entitiesToFilter: any = entityExceptionDoc[entity];
				const filteredEntities = entitiesToFilter.filter(
					(entity: BaseEntityExceptionRecord) =>
						!submitterDonorIds.includes(entity.submitter_donor_id),
				);
				entityExceptionDoc[entity] = filteredEntities as any;
				const doc = await entityExceptionDoc.save();
				return doc;
			}
			// mongo will return nulls for non existent docs
			// tslint doesn't complain about a null from a lib
			// tslint:disable-next-line
			return null;
		} catch (e) {
			L.error('Failed to delete exception', e);
			throw new DatabaseError('Cannot delete entity exception.');
		}
	},
};

export default entityExceptionRepository;
