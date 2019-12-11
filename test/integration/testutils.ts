import mongo from 'mongodb';
import _ from 'lodash';
import chai from 'chai';
import { Donor } from '../../src/clinical/clinical-entities';

export const cleanCollection = async (dburl: string, collection: string): Promise<any> => {
  const conn = await mongo.connect(dburl);
  console.log('cleanCollection connected');
  try {
    await conn.db('clinical').dropCollection(collection);
    console.log('cleanCollection dropped collection');
  } catch (err) {
    console.error('failed to drop collection', collection);
  }

  await conn.db('clinical').createCollection(collection);
  console.log('cleanCollection created collection');
  await conn.close();
};

export const resetCounters = async (dburl: string): Promise<any> => {
  const conn = await mongo.connect(dburl);
  await conn
    .db('clinical')
    .collection('counters')
    .updateMany({}, { $set: { seq: 0 } });
  await conn.close();
};

export const insertData = async (
  dburl: string,
  collection: string,
  document: any,
): Promise<any> => {
  console.log(`dburl ${dburl}`);
  const conn = await mongo.connect(dburl);
  await conn
    .db('clinical')
    .collection(collection)
    .insert(document);
  console.log('doc Id is:' + document._id);
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
    followUps: [],
    treatments: [],
  };
  if (!overrides) {
    return donor;
  }
  return _.merge(donor, overrides);
};

export const createDonorDoc = async (dburl: string, donorDoc: Donor) => {
  await insertData(dburl, 'donors', donorDoc);
  return donorDoc;
};

export const generateDonor = async (
  dburl: string,
  programId: string,
  submitterDonorId?: string,
) => {
  const submitterId = submitterDonorId || `${Date.now()}`;

  const doc = emptyDonorDocument({
    submitterId,
    programId,
    donorId: Date.now(),
  });
  return createDonorDoc(dburl, doc);
};

export async function assertDbCollectionEmpty(dburl: string, collection: string) {
  const conn = await mongo.connect(dburl);
  const count = await conn
    .db('clinical')
    .collection(collection)
    .count({});
  await conn.close();
  chai.expect(count).to.eq(0);
}

export async function findInDb(dburl: string, collection: string, filter: any) {
  const conn = await mongo.connect(dburl);
  const result = await conn
    .db('clinical')
    .collection(collection)
    .find(filter)
    .toArray();
  await conn.close();
  return result;
}
