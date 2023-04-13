const {
  calcDonorCoreEntityStats,
} = require('../dist/src/submission/submission-to-clinical/stat-calculator');

module.exports = {
  async up(db) {
    try {
      const donors = await db
        .collection('donors')
        .find({ completionStats: { $exists: true } })
        .toArray();

      donors.forEach(donor => {
        const updatedDonor = calcDonorCoreEntityStats(donor, {});
        const { donorId, completionStats } = updatedDonor;

        db.collection('donors').updateOne(
          { donorId: donorId },
          {
            $set: {
              completionStats,
            },
          },
        );
      });
    } catch (err) {
      console.error('failed', err);
      throw err;
    }
  },

  async down() {
    // No action
  },
};
