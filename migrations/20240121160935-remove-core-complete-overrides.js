/**
 * This migration is removing all references to `overriddenCoreCompletion` in donor completion stats.
 *
 * With the introduction of MissingEntityExceptions we no longer will use this property. This feature was
 * never used so this should result in no changes to any databases.
 */
module.exports = {
	async up(db, client) {
		try {
			const donors = await db
				.collection('donors')
				.find({ 'completionStats.overriddenCoreCompletion': { $exists: true } })
				.toArray();

			donors.forEach((donor) => {
				const donorId = donor.donorId;
				const completionStats = { ...donor.completionStats };
				delete completionStats.overriddenCoreCompletion;

				db.collection('donors').updateOne(
					{ donorId: donorId },
					{
						$set: {
							completionStats,
						},
					},
				);
			});
		} catch (e) {
			console.error('migration up failed', err);
			throw err;
		}
	},

	async down(db, client) {
		// irreversible, no action needs to be taken.
	},
};
