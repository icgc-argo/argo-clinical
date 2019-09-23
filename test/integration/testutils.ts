import mongo from 'mongodb';
import _ from 'lodash';

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
export const emptyDonorDocument = (overrides?: object) => {
  const donor = {
    donorId: '',
    gender: '',
    submitterId: '',
    programId: '',
    specimens: [],
    followUps: [],
    treatments: [],
    chemotherapy: [],
    HormoneTherapy: [],
  };
  if (!overrides) {
    return donor;
  }
  return _.merge(donor, overrides);
};
