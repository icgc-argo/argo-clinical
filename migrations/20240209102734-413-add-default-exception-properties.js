/**
 * ensure that all property entity exceptions are defined with default values ie. []
 */
const defaults = {
	follow_up: [],
	treatment: [],
	specimen: [],
};

module.exports = {
	async up(db, client) {
		try {
			const exceptions = await db
				.collection('entityexceptions')
				.find()
				.toArray();

			exceptions.forEach((exception) => {
				const _id = exception._id;
				const update = { ...defaults, ...exception };

				db.collection('entityexceptions').updateOne(
					{ _id },
					{
						$set: update,
					},
				);
			});
		} catch (e) {
			console.error('migration up failed', err);
			throw err;
		}
	},

	async down(db, client) {
		// no action needed
	},
};
