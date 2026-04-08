module.exports = {
	async up(db, client) {
		// Removing Index allows for new definition where name is not unique
		// Guard against fresh databases where the collection does not yet exist
		const collections = await db.listCollections({ name: 'dataschemas' }).toArray();
		if (collections.length > 0) {
			await db.collection('dataschemas').dropIndex({ name: 1 });
		}
	},

	async down(db, client) {},
};
