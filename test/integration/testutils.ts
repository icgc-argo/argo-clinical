import mongo from "mongodb";
import { Donor } from "../../src/clinical/clinical-entities";
import _ from "lodash";

export const cleanCollection = async (dburl: string, collection: string): Promise<any> => {
  console.log(`dburl ${dburl}`);
  const conn = await mongo.connect(dburl);
  await conn.db("clinical").dropCollection(collection);
  await conn.db("clinical").createCollection(collection);
  conn.close();
};

export const insertData = async (
  dburl: string,
  collection: string,
  document: any
): Promise<any> => {
  console.log(`dburl ${dburl}`);
  const conn = await mongo.connect(dburl);
  await conn
    .db("clinical")
    .collection(collection)
    .insert(document);
  console.log("doc Id is:" + document._id);
  conn.close();
  return document._id;
};
export const emptyDonorDocument = (overrides?: object) => {
  const donor = {
    donorId: "",
    gender: "",
    submitterId: "",
    programId: "",
    specimens: [],
    followUps: [],
    treatments: [],
    chemotherapy: [],
    HormoneTherapy: []
  };
  if (!overrides) {
    return donor;
  }
  return _.merge(donor, overrides);
};
