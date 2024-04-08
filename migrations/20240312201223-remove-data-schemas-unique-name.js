module.exports = {
	async up(db, client) {
		// Removing Index allows for new definition where name is not unique
		await db.collection('dataschemas').dropIndex({ name: 1 });
	},

	async down(db, client) {},
};
