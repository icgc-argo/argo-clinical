import { DeepReadonly } from 'deep-freeze';
import {
  Donor,
  Treatment,
  ClinicalInfo,
  FollowUp,
  Therapy,
  ClinicalObject,
} from '../../clinical/clinical-entities';
import {
  ActiveClinicalSubmission,
  ClinicalEntitySchemaNames,
  SubmittedClinicalRecordsMap,
  ClinicalUniqueIndentifier,
  ClinicalTherapySchemaNames,
  DonorFieldsEnum,
  ClinicalTherapyType,
} from '../submission-entities';
import _ from 'lodash';
import { loggerFor } from '../../logger';
import { Errors } from '../../utils';
import { getSingleClinicalObjectFromDonor } from './submission-to-clinical';
import { updateClinicalStatsAndDonorStats } from './stat-calculator';

const L = loggerFor(__filename);

export const mergeActiveSubmissionWithDonors = async (
  activeSubmission: DeepReadonly<ActiveClinicalSubmission>,
  donors: readonly DeepReadonly<Donor>[],
) => {
  const updatedDonors = _.cloneDeep(donors as Donor[]);
  for (const entityType in activeSubmission.clinicalEntities) {
    const entityData = activeSubmission.clinicalEntities[entityType];

    // Find the donor that matches each record, and update the entity within that donor
    entityData.records.forEach(record => {
      const donorId = record[DonorFieldsEnum.submitter_donor_id];
      const donor = _.find(updatedDonors, ['submitterId', donorId]);
      if (!donor) {
        throw new Errors.StateConflict(
          `Donor ${donorId} has not been registered but is part of the activeSubmission, merge cannot be completed.`,
        );
      }
      // update clinical info in clinical object
      let clinicalObjWithUpdatedInfo: ClinicalObject | Donor | undefined = { clinicalInfo: {} };
      switch (entityType) {
        case ClinicalEntitySchemaNames.DONOR:
          clinicalObjWithUpdatedInfo = updateDonorInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.SPECIMEN:
          clinicalObjWithUpdatedInfo = updateSpecimenInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS:
          clinicalObjWithUpdatedInfo = updatePrimaryDiagnosisInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.TREATMENT:
          clinicalObjWithUpdatedInfo = updateTreatementInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.FOLLOW_UP:
          clinicalObjWithUpdatedInfo = updateFollowUpInfo(donor, record);
          break;
        case ClinicalTherapySchemaNames.find(tsn => tsn === entityType):
          clinicalObjWithUpdatedInfo = updateTherapyInfoInDonor(donor, record, entityType, true);
          break;
        default:
          throw new Error(`Entity ${entityType} not implemented yet`);
      }

      // update clinical objects stats and aggregate donor stats
      updateClinicalStatsAndDonorStats(clinicalObjWithUpdatedInfo, donor, entityType);
    });
  }

  return updatedDonors;
};

// This function will return a merged donor of records mapped by clinical type and the DB exsistentDonor
export const mergeRecordsMapIntoDonor = (
  submittedRecordsMap: DeepReadonly<SubmittedClinicalRecordsMap>,
  exsistentDonor: DeepReadonly<Donor>,
) => {
  const mergedDonor: any = _.cloneDeep(exsistentDonor);

  submittedRecordsMap[ClinicalEntitySchemaNames.DONOR]?.forEach(r =>
    updateDonorInfo(mergedDonor, r),
  );

  submittedRecordsMap[ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]?.forEach(r =>
    updatePrimaryDiagnosisInfo(mergedDonor, r),
  );

  submittedRecordsMap[ClinicalEntitySchemaNames.SPECIMEN]?.forEach(r =>
    updateSpecimenInfo(mergedDonor, r),
  );

  submittedRecordsMap[ClinicalEntitySchemaNames.TREATMENT]?.forEach(r =>
    updateTreatementInfo(mergedDonor, r),
  );

  ClinicalTherapySchemaNames.forEach(tsn =>
    submittedRecordsMap[tsn]?.forEach(r => updateTherapyInfoInDonor(mergedDonor, r, tsn)),
  );

  submittedRecordsMap[ClinicalEntitySchemaNames.FOLLOW_UP]?.forEach(r =>
    updateFollowUpInfo(mergedDonor, r),
  );

  return mergedDonor;
};

/* ********************************* *
 * Private methods                   *
 * ********************************* */

// *** Info Update functions ***
const updateDonorInfo = (donor: Donor, record: ClinicalInfo) => {
  donor.clinicalInfo = record;
  return donor;
};

const updatePrimaryDiagnosisInfo = (donor: Donor, record: ClinicalInfo) => {
  donor.primaryDiagnosis = { clinicalInfo: record };
  return donor.primaryDiagnosis;
};

const updateSpecimenInfo = (donor: Donor, record: ClinicalInfo) => {
  const specimen = findSpecimen(donor, record);
  if (!specimen) return;
  specimen.clinicalInfo = record;
  return specimen;
};

const updateFollowUpInfo = (donor: Donor, record: ClinicalInfo): FollowUp => {
  let followUp = findFollowUp(donor, record);
  if (!followUp) {
    followUp = addNewFollowUpObj(donor);
  }
  followUp.clinicalInfo = record;
  return followUp;
};

const updateTreatementInfo = (donor: Donor, record: ClinicalInfo): Treatment => {
  let treatment = findTreatment(donor, record);
  if (!treatment) {
    treatment = addNewTreatmentObj(donor);
  }
  treatment.clinicalInfo = record;
  return treatment;
};

const updateTherapyInfoInDonor = (
  donor: Donor,
  record: ClinicalInfo,
  therapyType: ClinicalEntitySchemaNames,
  createDummyTreatmentIfMissing: boolean = false, // use this if treatment record exists and will be added later
): Therapy | undefined => {
  let treatment = findTreatment(donor, record);
  if (!treatment) {
    if (!createDummyTreatmentIfMissing) return;
    treatment = addNewTreatmentObj(donor);
  }
  return updateTherapyInfoInTreatment(treatment, record, therapyType as ClinicalTherapyType);
};

const updateTherapyInfoInTreatment = (
  treatment: Treatment,
  record: ClinicalInfo,
  therapyType: ClinicalTherapyType,
): Therapy => {
  let therapy = findTherapy(treatment, record, therapyType);
  if (!therapy) {
    therapy = addNewTherapyObj(treatment, therapyType);
  }
  therapy.clinicalInfo = record;
  return therapy;
};

/*** Empty clinical object adders ***/
const addNewTreatmentObj = (donor: Donor): Treatment => {
  const newTreatement = { clinicalInfo: {}, therapies: [] };
  donor.treatments = _.concat(donor.treatments || [], newTreatement);
  return _.last(donor.treatments) as Treatment;
};

const addNewFollowUpObj = (donor: Donor): FollowUp => {
  const newFollowUp = { clinicalInfo: {} };
  donor.followUps = _.concat(donor.followUps || [], newFollowUp);
  return _.last(donor.followUps) as FollowUp;
};

const addNewTherapyObj = (treatment: Treatment, therapyType: ClinicalTherapyType): Therapy => {
  const newTherapy = { clinicalInfo: {}, therapyType };
  treatment.therapies.push(newTherapy);
  return _.last(treatment.therapies) as Therapy;
};

/*** Clinical object finders ***/
const findSpecimen = (donor: Donor, record: ClinicalInfo) => {
  const specimenId = record[ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.SPECIMEN]];
  return _.find(donor.specimens, ['submitterId', specimenId]);
};

const findTreatment = (donor: Donor, record: ClinicalInfo) => {
  return findClinicalObject(donor, record, ClinicalEntitySchemaNames.TREATMENT) as Treatment;
};

const findFollowUp = (donor: Donor, record: ClinicalInfo) => {
  return findClinicalObject(donor, record, ClinicalEntitySchemaNames.FOLLOW_UP) as FollowUp;
};

function findClinicalObject(
  donor: Donor,
  newRecord: ClinicalInfo,
  entityType: Exclude<ClinicalEntitySchemaNames, ClinicalTherapyType>,
): ClinicalObject | undefined {
  const uniqueIdName = ClinicalUniqueIndentifier[entityType];
  const uniqueIdValue = newRecord[uniqueIdName];
  return getSingleClinicalObjectFromDonor(donor, entityType, {
    clinicalInfo: { [uniqueIdName]: uniqueIdValue },
  }) as ClinicalObject | undefined;
}

const findTherapy = (
  treatment: Treatment,
  record: ClinicalInfo,
  therapyType: ClinicalTherapyType,
): Therapy | undefined => {
  const identiferName = ClinicalUniqueIndentifier[therapyType];
  const identiferValue = record[identiferName];
  return (treatment.therapies || []).find(
    th => th.clinicalInfo[identiferName] === identiferValue && th.therapyType === therapyType,
  );
};
