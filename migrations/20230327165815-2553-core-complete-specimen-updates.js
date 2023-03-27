const cloneDeep = require('lodash/cloneDeep');
const isEmpty = require('lodash/isEmpty');
const mean = require('lodash/mean');

// Unable to import, see https://github.com/balmasi/migrate-mongoose/issues/64
// Functions copied from src/submission/submission-to-clinical/stat-calculator.ts

const dnaSampleTypes = ['Amplified DNA', 'ctDNA', 'Other DNA enrichments', 'Total DNA'];

const getCoreCompletionPercentage = fields => mean(Object.values(fields || {})) || 0;

const getCoreCompletionDate = (donor, percentage) =>
  percentage === 1
    ? donor.completionStats?.coreCompletionDate || donor.updatedAt || new Date().toDateString()
    : undefined;

const getEmptyCoreStats = () => {
  return cloneDeep({
    donor: 0,
    specimens: 0,
    primaryDiagnosis: 0,
    followUps: 0,
    treatments: 0,
  });
};

const dnaSampleFilter = specimen =>
  specimen.samples.some(sample => dnaSampleTypes.includes(sample.sampleType));

const filterTumourNormalRecords = (recordArray, type) =>
  recordArray.filter(specimen => specimen.tumourNormalDesignation === type);

const calculateSpecimenCompletionStats = donorSpecimenData => {
  const normalRegistrations = filterTumourNormalRecords(donorSpecimenData, 'Normal');
  const tumourRegistrations = filterTumourNormalRecords(donorSpecimenData, 'Tumour');

  const normalSubmissions = normalRegistrations.filter(specimen => !isEmpty(specimen.clinicalInfo));
  const tumourSubmissions = tumourRegistrations.filter(specimen => !isEmpty(specimen.clinicalInfo));

  const normalRatio =
    normalRegistrations.length === 0 || normalSubmissions.length === 0
      ? 0
      : normalSubmissions.length / normalRegistrations.length;

  const tumourRatio =
    tumourRegistrations.length === 0 || tumourSubmissions.length === 0
      ? 0
      : tumourSubmissions.length / tumourRegistrations.length;

  const completionValues = {
    normalSpecimens: normalRatio,
    tumourSpecimens: tumourRatio,
  };

  return completionValues;
};

module.exports = {
  async up(db) {
    try {
      const donors = await db
        .collection('donors')
        .find({ completionStats: { $exists: true } })
        .toArray();

      donors.forEach(async donor => {
        const coreStats = cloneDeep(donor.completionStats?.coreCompletion) || getEmptyCoreStats();

        const filteredDonorSpecimens = donor.specimens.filter(dnaSampleFilter);
        const { normalSpecimens, tumourSpecimens } = calculateSpecimenCompletionStats(
          filteredDonorSpecimens,
        );
        const filteredTumorNormalSpecimens = (normalSpecimens + tumourSpecimens) / 2;

        coreStats.specimens = filteredTumorNormalSpecimens;

        const coreCompletionPercentage = getCoreCompletionPercentage(coreStats);
        const coreCompletionDate = getCoreCompletionDate(donor, coreCompletionPercentage);
        donor.completionStats = {
          completionStats: {
            ...donor.completionStats,
            coreCompletion: coreStats,
            coreCompletionDate,
            coreCompletionPercentage,
          },
        };

        db.collection('donors').save(donor);
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
