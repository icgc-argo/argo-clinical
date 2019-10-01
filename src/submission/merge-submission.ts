import { DeepReadonly } from 'deep-freeze';
import { Donor, Specimen, Sample } from '../clinical/clinical-entities';
import { ActiveClinicalSubmission } from './submission-entities';
import { FileType } from './submission-api';
import _ from 'lodash';
import { loggerFor } from '../logger';
import { update } from './schema-api';
import { Errors } from '../utils';
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
          default:
            addOrUpdateClinicalRecord(donor, record, entityType);
            break;
        }
      } else {
        throw new Errors.StateConflict(
          `Donor ${donorId} has not been registered but is part of the activeSubmission, merge cannot be completed.`,
        );
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
  const specimen = findSpecimen(donor, record.submitter_specimen_id);
  specimen.specimenTissueSource = record.specimen_tissue_source;
  specimen.tumourNormalDesignation = record.tumour_normal_designation;
  specimen.clinicalInfo = _.omit(record, [
    'submitter_donor_id',
    'submitter_specimen_id',
    'tumour_normal_designation',
    'specimenTissueSource',
    'program_id',
  ]);
};

/*
 * Non specified Clinical Record.
 */

const addOrUpdateClinicalRecord = (
  donor: Donor,
  record: ClinicalEnitityRecord,
  entityType: string,
) => {
  // TODO - This **should** work, based on agreement of the ID format for all templates, but as of 2019-09-24 there are no templates to test with

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

/* ********************************* *
 * Some repeated convenience methods *
 * ********************************* */
const findSpecimen = (donor: Donor, specimenId: string) => {
  const specimen = _.find(donor.specimens, ['submitterId', specimenId]) as Specimen;
  if (!specimen) {
    throw new Errors.StateConflict(
      `Specimen ${specimenId} has not been registeredbut is part of the activeSubmission, merge cannot be completed.`,
    );
  }

  return specimen;
};

const findSample = (donor: Donor, specimenId: string, sampleId: string) => {
  const specimen = findSpecimen(donor, specimenId);
  const sample = _.find(specimen.samples, ['submitterId', sampleId]) as Sample;
  if (!sample) {
    throw new Errors.StateConflict(
      `Sample ${sampleId} has not been registered but is part of the activeSubmission, merge cannot be completed.`,
    );
  }
  return sample;
};
