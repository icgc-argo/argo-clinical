/*
 * Copyright (c) 2023 The Ontario Institute for Cancer Research. All rights reserved
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
import { entities as dictionaryEntities } from '@overturebio-stack/lectern-client';
import { loggerFor } from '../logger';
import { MongooseUtils } from '../utils';
const L = loggerFor(__filename);

export interface SchemaRepository {
	createOrUpdate(
		schema: dictionaryEntities.SchemasDictionary,
	): Promise<dictionaryEntities.SchemasDictionary | undefined>;

	/**
	 * Get a single dictionary of the provided name.
	 *
	 * If a value is given for `requestedVersion` this will look for the specified dictionary and return `undefined` if
	 * that version is not found. When a `requestedVersion` value is not provided, this will return the most recent
	 * version available.
	 *
	 * @param name
	 * @param options
	 */
	get(
		name: string,
		options: {
			requestedVersion?: string;
		},
	): Promise<dictionaryEntities.SchemasDictionary | undefined>;
}

export const schemaRepo: SchemaRepository = {
	createOrUpdate: async (
		schema: dictionaryEntities.SchemasDictionary,
	): Promise<dictionaryEntities.SchemasDictionary | undefined> => {
		const result = await DataSchemaModel.findOneAndUpdate(
			{
				name: schema.name,
				version: schema.version,
			},
			{
				name: schema.name,
				version: schema.version,
				schemas: schema.schemas,
			},
			{ upsert: true, new: true },
		).exec();

		const resultObj = MongooseUtils.toPojo(result) as dictionaryEntities.SchemasDictionary;
		return resultObj;
	},
	get: async (
		name: string,
		options?: {
			requestedVersion?: string;
		},
	): Promise<dictionaryEntities.SchemasDictionary | undefined> => {
		L.debug('in Schema repo get');
		const filter = options?.requestedVersion
			? { name, version: options.requestedVersion }
			: { name };
		const doc = await DataSchemaModel.findOne(filter)
			.sort({ version: -1 }) // sort by version descending to retrieve latest
			.exec();
		if (!doc) {
			return undefined;
		}
		return MongooseUtils.toPojo(doc) as dictionaryEntities.SchemasDictionary;
	},
};

type DataSchemaDocument = mongoose.Document & dictionaryEntities.SchemasDictionary;

const DataSchemaMongooseSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, unique: false },
		version: { type: String, required: true, unique: true },
		schemas: [],
	},
	{ timestamps: true },
);

export const DataSchemaModel = mongoose.model<DataSchemaDocument>(
	'dataschema',
	DataSchemaMongooseSchema,
);
