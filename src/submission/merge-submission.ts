import { DeepReadonly } from 'deep-freeze';
import { Donor, Specimen, Sample } from '../clinical/clinical-entities';
import { ActiveClinicalSubmission } from './submission-entities';
import { FileType } from './submission-api';
import _ from 'lodash';
import { loggerFor } from '../logger';
import { update } from './schema-api';
const L = loggerFor(__filename);

type ClinicalEnitityRecord = DeepReadonly<
  Readonly<{
    [key: string]: string;
  }>
>;

export const mergeActiveSubmissionWithDonors = async (
  activeSubmission: DeepReadonly<ActiveClinicalSubmission>,
  donors: readonly DeepReadonly<Donor>[],
) => {
  const updatedDonors = _.cloneDeep(donors as Donor[]);
  for (const entityType in activeSubmission.clinicalEntities) {
    const entityData = activeSubmission.clinicalEntities[entityType];

    // Find the donor that matches each record, and update the entity within that donor
    entityData.records.forEach(record => {
      const donorId = record.submitter_donor_id;
      const donor = _.find(updatedDonors, ['submitterId', donorId]);
      if (donor) {
        switch (entityType) {
          case FileType.DONOR:
            updateDonorFromSubmissionRecord(donor, record);
            break;
          case FileType.SPECIMEN:
            updateSpecimenRecord(donor, record);
            break;
          case FileType.SAMPLE:
            updateSampleRecord(donor, record);
            break;
          default:
            addOrUpdateClinicalRecord(donor, record, entityType);
            break;
        }
      }
    });
  }

  return updatedDonors;
};

const updateDonorFromSubmissionRecord = (donor: Donor, record: ClinicalEnitityRecord) => {
  donor.gender = record.gender;
  donor.clinicalInfo = _.omit(record, ['program_id', 'submitter_donor_id', 'gender']);
};
const updateSpecimenRecord = (donor: Donor, record: ClinicalEnitityRecord) => {
  // Find specimen in donor
  const specimen = _.find(donor.specimens, [
    'submitterId',
    record.submitter_specimen_id,
  ]) as Specimen;
  specimen.specimenType = record.specimen_type;
  specimen.tumourNormalDesignation = record.tumour_normal_designation;
  specimen.clinicalInfo = _.omit(record, [
    'submitter_donor_id',
    'submitter_specimen_id',
    'tumour_normal_designation',
    'program_id',
  ]);
};
const updateSampleRecord = (donor: Donor, record: ClinicalEnitityRecord) => {
  const specimen = _.find(donor.specimens, [
    'submitterId',
    record.submitter_specimen_id,
  ]) as Specimen;
  const sample = _.find(specimen.samples, ['submitterId', record.submitter_sample_id]) as Sample;

  // Samples only have the one update to make:
  sample.sampleType = record.sample_type;
};

/*
 * Non specified Clinical Record.
 */

const addOrUpdateClinicalRecord = (
  donor: Donor,
  record: ClinicalEnitityRecord,
  entityType: string,
) => {
  // TODO - This should work based on agreement of the IDs for all templates, but as of 2019-09-24 there are no templates to test with

  const submitterIdKey = `submitter_${_.snakeCase(entityType)}_id`;
  const submitterId = record[submitterIdKey];

  const entityList = _.get(donor, entityType, []);
  const existingEntity = _.find(entityList, ['submitterId', submitterId]);
  if (existingEntity) {
    existingEntity.clinicalInfo = _.omit(record, ['program_id', submitterIdKey]);
    console.log(existingEntity);
  } else {
    entityList.push({
      submitterId,
      clinicalInfo: _.omit(record, ['program_id', submitterIdKey]),
    });
  }
};
