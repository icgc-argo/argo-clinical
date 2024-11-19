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

import chai from 'chai';
import _ from 'lodash';
import mongo from 'mongodb';
import mysql from 'mysql2/promise';
import { Donor } from '../../src/clinical/clinical-entities';

export const clearCollections = async (dbUrl: string, collections: string[]) => {
	try {
		const promises = collections.map((collectionName) => cleanCollection(dbUrl, collectionName));
		await Promise.all(promises);
		await resetCounters(dbUrl);
		return;
	} catch (err) {
		console.error(err);
		return err;
	}
};

export const cleanCollection = async (dbUrl: string, collection: string): Promise<any> => {
	const connection = await mongo.connect(dbUrl);
	try {
		const collections = await connection
			.db('clinical')
			.listCollections()
			.toArray();

		if (collections.some((collectionRecord) => collectionRecord.name === collection)) {
			await connection
				.db('clinical')
				.collection(collection)
				.remove({});

			await connection.db('clinical').dropCollection(collection);
		}
	} catch (err) {
		console.error('failed to drop collection', collection, err);
	}
	await connection.db('clinical').createCollection(collection);
	await connection.close();
};

export const resetCounters = async (dbUrl: string): Promise<any> => {
	const conn = await mongo.connect(dbUrl);
	await conn
		.db('clinical')
		.collection('counters')
		.updateMany({}, { $set: { seq: 0 } });
	await conn.close();
};

export const insertData = async (
	dbUrl: string,
	collection: string,
	document: any,
): Promise<any> => {
	const conn = await mongo.connect(dbUrl);
	await conn
		.db('clinical')
		.collection(collection)
		.insert(document);
	await conn.close();
	return document._id;
};

export async function execMysqlQuery(sql: string, pool: mysql.Pool) {
	await pool.query(sql);
}

export async function createtRxNormTables(pool: mysql.Pool) {
	const sql = 'CREATE TABLE RXNCONSO (RXCUI VARCHAR(255), STR VARCHAR(255))';
	await execMysqlQuery(sql, pool);
}

export async function insertRxNormDrug(id: string, name: string, pool: mysql.Pool) {
	await execMysqlQuery(`insert into RXNCONSO (RXCUI, STR) values('${id}', '${name}')`, pool);
}

export const updateData = async (
	dbUrl: string,
	collection: string,
	document: any,
	filter: any = {},
): Promise<any> => {
	const conn = await mongo.connect(dbUrl);
	await conn
		.db('clinical')
		.collection(collection)
		.update(filter, document, { upsert: true });
	await conn.close();
	return document._id;
};

export const emptyDonorDocument = (overrides?: Partial<Donor>) => {
	const gender = Math.random() > 0.5 ? 'Male' : 'Female';
	const donor: Donor = {
		donorId: 1,
		gender: gender,
		submitterId: '',
		schemaMetadata: {
			isValid: true,
			lastValidSchemaVersion: '1.0',
			originalSchemaVersion: '1.0',
		},
		programId: '',
		specimens: [],
		clinicalInfo: {},
		createdAt: undefined,
		followUps: [],
		primaryDiagnoses: [],
		familyHistory: [],
		exposure: [],
		comorbidity: [],
		biomarker: [],
		treatments: [],
	};
	if (!overrides) {
		return donor;
	}
	return _.merge(donor, overrides);
};

export const createDonorDoc = async (dbUrl: string, donorDoc: Donor) => {
	await insertData(dbUrl, 'donors', donorDoc);
	return donorDoc;
};

export const generateDonor = async (
	dbUrl: string,
	programId: string,
	submitterDonorId?: string,
) => {
	const submitterId = submitterDonorId || `${Date.now()}`;

	const doc = emptyDonorDocument({
		submitterId,
		programId,
		donorId: Date.now(),
	});
	return createDonorDoc(dbUrl, doc);
};

export async function assertDbCollectionEmpty(dbUrl: string, collection: string) {
	const conn = await mongo.connect(dbUrl);
	const count = await conn
		.db('clinical')
		.collection(collection)
		.count({});
	await conn.close();
	chai.expect(count).to.eq(0);
}

export async function findInDb(dbUrl: string, collection: string, filter: any) {
	const conn = await mongo.connect(dbUrl);
	const result = await conn
		.db('clinical')
		.collection(collection)
		.find(filter)
		.sort({ $natural: -1 })
		.toArray();
	await conn.close();
	return result;
}
