module.exports = {
  async up(db, client) {
    await db.collection('newCollection').insertOne({ _id: '1', key: 'test' });
    await db.collection('newCollection').insertOne({ _id: '1', key: 'test' });
    await db.collection('newCollection').deleteOne({ _id: '1', key: 'test' });
    // you can write some tests to verify everything is good and throw error if not.
  },

  async down(db, client) {
    await db.collection('newCollection').deleteOne({ key: 'test' });
  },
};
