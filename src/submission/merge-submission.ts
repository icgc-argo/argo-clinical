import { DeepReadonly } from 'deep-freeze';
import { Donor, Specimen } from '../clinical/clinical-entities';
import { ActiveClinicalSubmission, FieldsEnum, ClinicalEntityType } from './submission-entities';
import _ from 'lodash';
import { loggerFor } from '../logger';
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
      const donorId = record[FieldsEnum.submitter_donor_id];
      const donor = _.find(updatedDonors, ['submitterId', donorId]);
      if (donor) {
        switch (entityType) {
          case ClinicalEntityType.DONOR:
            updateDonorFromSubmissionRecord(donor, record);
            break;
          case ClinicalEntityType.SPECIMEN:
            updateSpecimenRecord(donor, record);
            break;
          case ClinicalEntityType.PRIMARY_DIAGNOSES:
            updatePrimaryDiagnosesRecord(donor, record);
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
  donor.clinicalInfo = _.omit(record, [FieldsEnum.submitter_donor_id]);
};
const updateSpecimenRecord = (donor: Donor, record: ClinicalEnitityRecord) => {
  // Find specimen in donor
  const specimen = findSpecimen(donor, record[FieldsEnum.submitter_specimen_id]);
  specimen.clinicalInfo = _.omit(record, [
    FieldsEnum.submitter_donor_id,
    FieldsEnum.submitter_specimen_id,
  ]);
};

const updatePrimaryDiagnosesRecord = (donor: Donor, record: ClinicalEnitityRecord) => {
  donor.primaryDiagnosis = _.omit(record, [FieldsEnum.submitter_donor_id]);
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

  // enforce camel case for entity types like primaryDiagnosis, followUps, etc.
  const entityList = _.get(donor, _.camelCase(entityType), []);
  const existingEntity = _.find(entityList, ['submitterId', submitterId]);
  if (existingEntity) {
    existingEntity.clinicalInfo = _.omit(record, [FieldsEnum.program_id, submitterIdKey]);
    console.log(existingEntity);
  } else {
    entityList.push({
      submitterId,
      clinicalInfo: _.omit(record, [FieldsEnum.program_id, submitterIdKey]),
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
