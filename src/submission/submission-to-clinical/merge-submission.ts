import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import { ActiveClinicalSubmission, FieldsEnum, ClinicalEntityType } from '../submission-entities';
import _ from 'lodash';
import { loggerFor } from '../../logger';
import { Errors } from '../../utils';
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
      if (!donor) {
        throw new Errors.StateConflict(
          `Donor ${donorId} has not been registered but is part of the activeSubmission, merge cannot be completed.`,
        );
      }

      switch (entityType) {
        case ClinicalEntityType.DONOR:
          donor.clinicalInfo = record;
          break;
        case ClinicalEntityType.SPECIMEN:
          updateSpecimenRecord(donor, record);
          break;
        case ClinicalEntityType.PRIMARY_DIAGNOSIS:
          donor.primaryDiagnosis = record;
          break;
        default:
          addOrUpdateClinicalEntity(donor, entityType, record);
          break;
      }
    });
  }

  return updatedDonors;
};

const updateSpecimenRecord = (donor: Donor, record: ClinicalEnitityRecord) => {
  // Find specimen in donor
  const specimen = findSpecimen(donor, record[FieldsEnum.submitter_specimen_id]);
  specimen.clinicalInfo = record;
};

const addOrUpdateClinicalEntity = (
  donor: any,
  clinicalEntitySnakeCase: string,
  record: ClinicalEnitityRecord,
) => {
  const clinicalEntityName = _.camelCase(clinicalEntitySnakeCase);
  if (donor[clinicalEntityName] == undefined) {
    donor[clinicalEntityName] = new Array<object>();
  }
  if (!_.isArray(donor[clinicalEntityName])) {
    throw new Error('expecting an array for generic clinical entity');
  }
  donor[clinicalEntityName].push(record);
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
