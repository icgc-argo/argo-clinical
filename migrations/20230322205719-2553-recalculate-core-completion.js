import { forceRecalcDonorCoreEntityStats } from '../src/submission/submission-to-clinical/stat-calculator';

module.exports = {
  async up(db, client) {
    try {
      const donors = await db
        .collection('donors')
        .find(filterUp)
        .toArray();

      donors.forEach(donor => {
        const updatedDonor = forceRecalcDonorCoreEntityStats(donor, coreCompletionOverride);

        db.collection('donors').save(updatedDonor);
      });
    } catch (err) {
      console.error('failed', err);
      throw err;
    }
  },
};