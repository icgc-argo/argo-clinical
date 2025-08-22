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

import {
	analyzer,
	entities as dictionaryEntities,
	restClient as dictionaryRestClient,
	functions as dictionaryService,
	parallel,
} from '@overturebio-stack/lectern-client';
import { DeepReadonly } from 'deep-freeze';
import _ from 'lodash';
import { Donor } from '../clinical/clinical-entities';
import { ClinicalEntitySchemaNames } from '../common-model/entities';
import { getClinicalEntitiesFromDonorBySchemaName } from '../common-model/functions';
import { loggerFor } from '../logger';
import { MigrationManager } from '../submission/migration/migration-manager';
import { schemaRepo } from './repo';
import { migrationRepo } from '../submission/migration/migration-repo';
const L = loggerFor(__filename);

let manager: SchemaManager;

export type SchemaWithFields = {
	name: string;
	fields: string[];
};

class SchemaManager {
	private currentSchemaDictionary: dictionaryEntities.SchemasDictionary = {
		schemas: [],
		name: '',
		version: '',
	};

	constructor(private schemaServiceUrl: string) {}

	/**
	 * This will get the currently in use dictionary version. This call will double check with the db
	 * to see if there has been a successful migration that has changed the current version, and if so
	 * it will update the current version to the dictionary from the latest migration. This update will
	 * read the dictionary data either from the DB, or from Lectern if it is not in the DB yet.
	 *
	 * @throws An error if no data for the latest dictionary can be found
	 *
	 * @returns the current dictionary according to the lateset migration in the DB
	 */
	getCurrent = async (): Promise<dictionaryEntities.SchemasDictionary> => {
		const latestMigration = await migrationRepo.getLatestSuccessful();
		if (!latestMigration) {
			return this.currentSchemaDictionary;
		}
		if (latestMigration.toVersion === this.currentSchemaDictionary.version) {
			return this.currentSchemaDictionary;
		}
		const newDictionary = await this.loadSchemaAndSave(
			this.currentSchemaDictionary.name,
			latestMigration.toVersion,
		);
		this.currentSchemaDictionary = newDictionary;
		return this.currentSchemaDictionary;
	};

	getCurrentName = (): string => {
		// This does not need to use this.getCurrent() since we have no situation where the name will update
		return this.currentSchemaDictionary.name;
	};

	getCurrentVersion = async (): Promise<string> => {
		const currDictionary = await this.getCurrent();
		return currDictionary.version;
	};

	getSchemasWithFields = async (
		schemaDefConstratint: object | Function = {}, // k-v SchemaDefinition property constraints; e.g. { name: 'donor' } or function executed on each schema def
		fieldDefConstraint: object | Function = {}, // k-v FieldDefinition property constraints; e.g. { restrictions: { required: true } }  or function executed on each field def
	): Promise<SchemaWithFields[]> => {
		const currentDictionary = await this.getCurrent();
		return _(currentDictionary.schemas)
			.filter(schemaDefConstratint)
			.map((s) => {
				return {
					name: s.name,
					fields: _(s.fields)
						.filter(fieldDefConstraint)
						.map((f) => f.name)
						.value(),
				};
			})
			.value();
	};

	getSchemaNames = async (): Promise<string[]> => {
		const currentDictionary = await this.getCurrent();
		return currentDictionary.schemas.map((s) => s.name);
	};

	getSchemaNamesAndFields = async (): Promise<SchemaWithFields[]> => {
		const currentDictionary = await this.getCurrent();
		return currentDictionary.schemas.map((s) => {
			return {
				name: s.name,
				fields: _(s.fields)
					.map((f) => f.name)
					.value(),
			};
		});
	};

	getSchemaFieldNamesWithPriority = async (
		schemaName: string,
		schemasDictionary?: dictionaryEntities.SchemasDictionary,
	): Promise<dictionaryEntities.FieldNamesByPriorityMap> => {
		const dictionaryToUse = await this.chooseSchemasDictionaryToUse(schemasDictionary);
		return dictionaryService.getSchemaFieldNamesWithPriority(dictionaryToUse, schemaName);
	};

	/**
	 * This method does three things:
	 * 1- populate default values for empty optional fields
	 * 2- validate the record against the schema
	 * 3- convert the raw data from strings to their proper type if needed.
	 *
	 * @param schemaName the schema we want to process records for
	 * @param records the raw records list
	 *
	 * @returns promise object contains the validation errors and the valid processed records.
	 */
	process = async (
		schemaName: string,
		record: Readonly<dictionaryEntities.DataRecord>,
		index: number,
		schemasDictionary?: dictionaryEntities.SchemasDictionary,
	): Promise<dictionaryEntities.SchemaProcessingResult> => {
		const dictionaryToUse = await this.chooseSchemasDictionaryToUse(schemasDictionary);
		return dictionaryService.process(dictionaryToUse, schemaName, record, index);
	};

	/**
	 * This method does same thing as normal process, however it utilises
	 * worker threads to parallelise record processing.
	 *
	 * @see process
	 *
	 * @param schemaName the schema we want to process records for
	 * @param records the raw records list
	 * @param index the original record index
	 * @param schemasDictionary optional schema to use for validation
	 * @returns promise object contains the validation errors
	 *          and the valid processed records.
	 */
	processParallel = async (
		schemaName: string,
		record: Readonly<dictionaryEntities.DataRecord>,
		index: number,
		schemasDictionary?: dictionaryEntities.SchemasDictionary,
	): Promise<dictionaryEntities.SchemaProcessingResult> => {
		const dictionaryToUse = await this.chooseSchemasDictionaryToUse(schemasDictionary);
		return await parallel.processRecord(dictionaryToUse, schemaName, record, index);
	};

	chooseSchemasDictionaryToUse = async (
		passedDictionary?: dictionaryEntities.SchemasDictionary,
	) => {
		if (!passedDictionary) {
			return await this.getCurrent();
		}
		return passedDictionary;
	};

	analyzeChanges = async (oldVersion: string, newVersion: string) => {
		const result = await analyzer.fetchDiffAndAnalyze(
			this.schemaServiceUrl,
			this.getCurrentName(),
			oldVersion,
			newVersion,
		);
		return result;
	};

	/**
	 * Fetches schema from lectern server and then saves it to `this.currentSchemaDictionary`.
	 *
	 * @throws Throws an error if fetch fails.
	 */
	loadAndSaveNewVersion = async (
		name: string,
		newVersion: string,
	): Promise<dictionaryEntities.SchemasDictionary> => {
		const newSchema = await this.loadSchemaByVersion(name, newVersion);
		if (newSchema == undefined) {
			throw new Error("couldn't save/update new schema, schema is undefined.");
		}
		const result = await schemaRepo.createOrUpdate(newSchema);
		if (!result) {
			throw new Error("couldn't save/update new schema.");
		}
		this.currentSchemaDictionary = result;
		return this.currentSchemaDictionary;
	};

	/**
	 * Fetches schema from lectern server,
	 *
	 * @throws Throws an error if fetch fails.
	 */
	loadSchemaByVersion = async (
		name: string,
		version: string,
	): Promise<dictionaryEntities.SchemasDictionary> => {
		try {
			const newSchema = await dictionaryRestClient.fetchSchema(
				this.schemaServiceUrl,
				name,
				version,
			);
			return newSchema;
		} catch (err) {
			L.error('Failed to fetch schema: ', err);
			throw new Error('Failed to fetch schema: ' + (err as Error).message); // added 'as Error' due to Typescript version upgrade
		}
	};

	/**
	 * Loads new schema data from the DB. If the data is not available in the DB, attempts to fetch
	 * the data from lectern. If the data is found, this will create a new DB entry and set the current
	 * dictionary with that data.
	 *
	 * @throws Error when the fetch fails to return the new dictionary, or when a db write fails
	 */
	loadSchemaAndSave = async (
		name: string,
		version: string,
	): Promise<dictionaryEntities.SchemasDictionary> => {
		L.debug(`in loadSchema ${version}`);
		const storedSchema = await schemaRepo.get(name, { requestedVersion: version });
		if (storedSchema) {
			L.info(`schema found in db`);
			this.currentSchemaDictionary = storedSchema;
			return storedSchema;
		}

		// if the schema is not complete we need to load it from the
		// schema service (lectern)
		L.debug(`fetching schema from schema service.`);
		const result = await this.loadSchemaByVersion(name, version);
		if (result == undefined) {
			throw new Error("couldn't save/update new schema, schema is undefined.");
		}
		L.info(`fetched schema ${result.version}`);
		this.currentSchemaDictionary = result;
		const saved = await schemaRepo.createOrUpdate(this.currentSchemaDictionary);
		if (!saved) {
			throw new Error("couldn't save/update new schema");
		}
		L.info(`schema saved in db`);
		return saved;
	};

	/**
	 * Initiate new migration to new schema version
	 */
	updateSchemaVersion = async (toVersion: string, updater: string, sync?: boolean) => {
		const currentDictionaryVersion = await this.getCurrentVersion();
		return await MigrationManager.submitMigration(
			currentDictionaryVersion,
			toVersion,
			updater,
			false,
			sync,
		);
	};

	probeSchemaUpgrade = async (from: string, to: string) => {
		const analysis = await this.analyzeChanges(from, to);
		const breakingChanges = MigrationManager.findInvalidatingChangesFields(analysis);
		return {
			analysis,
			breakingChanges,
		};
	};

	dryRunSchemaUpgrade = async (toVersion: string, initiator: string) => {
		return await MigrationManager.dryRunSchemaUpgrade(toVersion, initiator);
	};

	getMigration = async (migrationId: string | undefined) => {
		return await MigrationManager.getMigration(migrationId);
	};

	resumeMigration = async (sync: boolean) => {
		return await MigrationManager.resumeMigration(sync);
	};
}

export const revalidateAllDonorClinicalEntitiesAgainstSchema = (
	donor: DeepReadonly<Donor>,
	schema: dictionaryEntities.SchemasDictionary,
) => {
	const clinicalSchemaNames = getSchemaNamesForDonorClinicalEntities(donor);
	let isValid = true;
	for (const schemaName of clinicalSchemaNames) {
		if (!isValid) {
			return;
		}
		const errs = MigrationManager.validateDonorEntityAgainstNewSchema(schemaName, schema, donor);
		isValid = !errs || errs.length == 0;
	}
	return isValid;
};

const getSchemaNamesForDonorClinicalEntities = (donor: DeepReadonly<Donor>) => {
	const result: ClinicalEntitySchemaNames[] = [];
	for (const key of Object.values(ClinicalEntitySchemaNames)) {
		const clinicalRecords = getClinicalEntitiesFromDonorBySchemaName(donor, key);

		if (clinicalRecords.length > 0) {
			result.push(key);
		}
	}
	return result;
};

export function instance() {
	if (manager === undefined) {
		throw new Error('manager not initialized, you should call create first');
	}
	return manager;
}

export function create(schemaServiceUrl: string) {
	manager = new SchemaManager(schemaServiceUrl);
	manager
		.getCurrent()
		.catch((e) =>
			L.error(
				'Was unable to retrieve latest Schemas during initialization of SchemaManager.',
				undefined,
			),
		);
}
