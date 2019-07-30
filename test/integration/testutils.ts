import mongo from "mongodb";

export const cleanCollection = async (dburl: string, collection: string): Promise<any> => {
  console.log(`dburl ${dburl}`);
  const conn = await mongo.connect(dburl);
  await conn.db("clinical").dropCollection(collection);
  await conn.db("clinical").createCollection(collection);
  conn.close();
};
