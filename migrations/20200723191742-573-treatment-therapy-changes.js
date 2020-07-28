module.exports = {
  async up(db, client) {
    const donors = await db.collection('donors').find({});
    donors.forEach(donor => {
      if (!donor.treatments) return;
      donor.treatments.forEach((t, i) => {
        if (t.clinicalInfo.hasOwnProperty('response_to_therapy')) {
          const response_to_therapy_temp = t.clinicalInfo.response_to_therapy;
          delete donor.treatments[i].clinicalInfo.response_to_therapy;
          t.clinicalInfo.response_to_treatment = response_to_therapy_temp;
        }

        if (t.clinicalInfo.hasOwnProperty('outcome_of_therapy')) {
          const outcome_of_therapy_temp = t.clinicalInfo.outcome_of_therapy;
          delete donor.treatments[i].clinicalInfo.outcome_of_therapy;
          t.clinicalInfo.outcome_of_treatment = outcome_of_therapy_temp;
        }
      });
      db.collection('donors').save(donor);
    });
  },

  async down(db, client) {
    const donors = await db.collection('donors').find({});
    donors.forEach(donor => {
      if (!donor.treatments) return;
      donor.treatments.forEach((t, i) => {
        if (t.clinicalInfo.hasOwnProperty('response_to_treatment')) {
          const response_to_therapy_temp = t.clinicalInfo.response_to_treatment;
          delete donor.treatments[i].clinicalInfo.response_to_treatment;
          t.clinicalInfo.response_to_therapy = response_to_therapy_temp;
        }

        if (t.clinicalInfo.hasOwnProperty('outcome_of_treatment')) {
          const outcome_of_therapy_temp = t.clinicalInfo.outcome_of_treatment;
          delete donor.treatments[i].clinicalInfo.outcome_of_treatment;
          t.clinicalInfo.outcome_of_therapy = outcome_of_therapy_temp;
        }
      });
      db.collection('donors').save(donor);
    });
  },
};
