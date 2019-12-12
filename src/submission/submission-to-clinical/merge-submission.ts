import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import {
  ActiveClinicalSubmission,
  SampleRegistrationFieldsEnum,
  ClinicalEntitySchemaNames,
  ClinicalUniqueIndentifier,
} from '../submission-entities';
import _ from 'lodash';
import { loggerFor } from '../../logger';
import { Errors, F, mergeAndDeleteRemoved } from '../../utils';
import { getClinicalEntitiesFromDonorBySchemaName } from './submission-to-clinical';
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
      const donorId = record[SampleRegistrationFieldsEnum.submitter_donor_id];
      const donor = _.find(updatedDonors, ['submitterId', donorId]);
      if (!donor) {
        throw new Errors.StateConflict(
          `Donor ${donorId} has not been registered but is part of the activeSubmission, merge cannot be completed.`,
        );
      }

      switch (entityType) {
        case ClinicalEntitySchemaNames.DONOR:
          donor.clinicalInfo = record;
          break;
        case ClinicalEntitySchemaNames.SPECIMEN:
          updateSpecimenRecord(donor, record);
          break;
        case ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS:
          donor.primaryDiagnosis = record;
          break;
        case ClinicalEntitySchemaNames.FOLLOW_UP:
          updateFollowUp(donor, record);
          break;
        default:
          throw new Error(`Entity ${entityType} not implemented yet`);
      }
    });
  }

  return updatedDonors;
};

const updateSpecimenRecord = (donor: Donor, record: ClinicalEnitityRecord) => {
  // Find specimen in donor
  const specimen = findSpecimen(donor, record[SampleRegistrationFieldsEnum.submitter_specimen_id]);
  specimen.clinicalInfo = record;
};

const updateFollowUp = (donor: Donor, record: ClinicalEnitityRecord) => {
  const followUpClinicalInfo = getFollowUp(
    donor,
    record[ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.FOLLOW_UP]],
  );

  if (followUpClinicalInfo) {
    mergeAndDeleteRemoved(followUpClinicalInfo, record);
    return;
  }

  if (!donor.followUps) {
    donor.followUps = [];
  }

  donor.followUps.push({
    clinicalInfo: record,
  });
};

/* ********************************* *
 * Some repeated convenience methods *
 * ********************************* */
const findSpecimen = (donor: Donor, specimenId: string) => {
  const specimen = _.find(donor.specimens, ['submitterId', specimenId]);
  if (!specimen) {
    throw new Errors.StateConflict(
      `Specimen ${specimenId} has not been registeredbut is part of the activeSubmission, merge cannot be completed.`,
    );
  }

  return specimen;
};

function getFollowUp(donor: Donor, followUpId: string) {
  const followUp = getClinicalEntitiesFromDonorBySchemaName(
    donor,
    ClinicalEntitySchemaNames.FOLLOW_UP,
  ).find(f => f[ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.FOLLOW_UP]] === followUpId);
  return followUp;
}
