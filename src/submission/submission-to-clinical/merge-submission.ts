import { DeepReadonly } from 'deep-freeze';
import { Donor, Treatment, ClinicalInfo, FollowUp } from '../../clinical/clinical-entities';
import {
  ActiveClinicalSubmission,
  SampleRegistrationFieldsEnum,
  ClinicalEntitySchemaNames,
  TreatmentFieldsEnum,
  SubmittedClinicalRecordsMap,
  ClinicalUniqueIndentifier,
} from '../submission-entities';
import _ from 'lodash';
import { loggerFor } from '../../logger';
import { Errors, mergeAndDeleteRemoved } from '../../utils';
import {
  getClinicalEntitiesFromDonorBySchemaName,
  getSingleClinicalObjectFromDonor,
} from './submission-to-clinical';
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
      const donorId = record[SampleRegistrationFieldsEnum.submitter_donor_id];
      const donor = _.find(updatedDonors, ['submitterId', donorId]);
      if (!donor) {
        throw new Errors.StateConflict(
          `Donor ${donorId} has not been registered but is part of the activeSubmission, merge cannot be completed.`,
        );
      }

      switch (entityType) {
        case ClinicalEntitySchemaNames.DONOR:
          updateDonorInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.SPECIMEN:
          updateSpecimenInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS:
          updatePrimaryDiagnosisInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.TREATMENT:
          addOrUpdateTreatementInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.CHEMOTHERAPY: // other therapies here e.g. HormoneTherapy
          addOrUpdateTherapyInfoInDonor(donor, record, entityType, true);
          break;
        case ClinicalEntitySchemaNames.FOLLOW_UP:
          updateOrAddFollowUp(donor, record);
          break;
        default:
          throw new Error(`Entity ${entityType} not implemented yet`);
      }
    });
  }

  return updatedDonors;
};

// This function will return a merged donor of records mapped by clinical type and the DB exsistentDonor
export const mergeRecordsMapIntoDonor = (
  submittedRecordsMap: DeepReadonly<SubmittedClinicalRecordsMap>,
  exsistentDonor: DeepReadonly<Donor>,
) => {
  const submittedClinicalTypes: Set<String> = new Set(Object.keys(submittedRecordsMap));
  const mergedDonor: any = _.cloneDeep(exsistentDonor);

  if (submittedClinicalTypes.has(ClinicalEntitySchemaNames.DONOR)) {
    updateDonorInfo(mergedDonor, submittedRecordsMap[ClinicalEntitySchemaNames.DONOR][0]);
  }
  if (submittedClinicalTypes.has(ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS)) {
    updatePrimaryDiagnosisInfo(
      mergedDonor,
      submittedRecordsMap[ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS][0],
    );
  }
  if (submittedClinicalTypes.has(ClinicalEntitySchemaNames.SPECIMEN)) {
    submittedRecordsMap[ClinicalEntitySchemaNames.SPECIMEN].forEach(r =>
      updateSpecimenInfo(mergedDonor, r),
    );
  }
  if (submittedClinicalTypes.has(ClinicalEntitySchemaNames.TREATMENT)) {
    submittedRecordsMap[ClinicalEntitySchemaNames.TREATMENT].forEach(r =>
      addOrUpdateTreatementInfo(mergedDonor, r),
    );
  }
  if (submittedClinicalTypes.has(ClinicalEntitySchemaNames.CHEMOTHERAPY)) {
    submittedRecordsMap[ClinicalEntitySchemaNames.CHEMOTHERAPY].forEach(r =>
      addOrUpdateTherapyInfoInDonor(mergedDonor, r, ClinicalEntitySchemaNames.CHEMOTHERAPY),
    );
  }

  if (submittedClinicalTypes.has(ClinicalEntitySchemaNames.FOLLOW_UP)) {
    submittedRecordsMap[ClinicalEntitySchemaNames.FOLLOW_UP].forEach(r =>
      updateOrAddFollowUp(mergedDonor, r),
    );
  }

  return mergedDonor;
};

// *** Info Update functions ***
const updateDonorInfo = (donor: Donor, record: any) => {
  donor.clinicalInfo = record;
  return donor.clinicalInfo;
};

const updatePrimaryDiagnosisInfo = (donor: Donor, record: any) => {
  donor.primaryDiagnosis = record;
  return donor.primaryDiagnosis;
};

const updateSpecimenInfo = (donor: Donor, record: any) => {
  const specimen = findSpecimen(donor, record[SampleRegistrationFieldsEnum.submitter_specimen_id]);
  if (!specimen) return;
  specimen.clinicalInfo = record;
  return specimen;
};

const updateOrAddFollowUp = (donor: Donor, record: ClinicalInfo) => {
  const followUp = findFollowUp(donor, record[
    ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.FOLLOW_UP]
  ] as string);

  if (followUp) {
    followUp.clinicalInfo = record;
    return;
  }

  if (!donor.followUps) {
    donor.followUps = [];
  }

  donor.followUps.push({
    clinicalInfo: record,
  });
};

const addOrUpdateTreatementInfo = (donor: Donor, record: ClinicalInfo): Treatment => {
  const submitterTreatementId = record[
    ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.TREATMENT]
  ] as string;
  // Find treatment in donor and update
  const treatment = findTreatment(donor, submitterTreatementId);
  if (treatment) {
    treatment.clinicalInfo = record;
    return treatment;
  }
  // treatment doesn't exsist, so add it
  donor.treatments = _.concat(donor.treatments || [], { clinicalInfo: record, therapies: [] });
  return donor.treatments[0];
};

const addOrUpdateTherapyInfoInDonor = (
  donor: Donor,
  record: ClinicalInfo,
  therapyType: ClinicalEntitySchemaNames,
  createDummyTreatmentIfMissing: boolean = false, // use this if treatment record exists and will be added later
) => {
  const treatementId = record[
    ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.TREATMENT]
  ] as string;
  let treatment = findTreatment(donor, treatementId);
  if (!treatment) {
    if (!createDummyTreatmentIfMissing) return;
    treatment = addOrUpdateTreatementInfo(donor, {
      [ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.TREATMENT]]: treatementId,
    });
  }
  addOrUpdateTherapyInfoInTreatment(treatment, record, therapyType);
};

function addOrUpdateTherapyInfoInTreatment(
  treatment: Treatment,
  record: ClinicalInfo,
  therapyType: ClinicalEntitySchemaNames,
) {
  const idName = ClinicalUniqueIndentifier[therapyType];
  const idVal = record[idName];
  const therapy = findTherapyWithIdentifier(treatment, therapyType, idName, idVal);
  if (therapy) {
    therapy.clinicalInfo = record;
    return;
  }
  treatment.therapies.push({ clinicalInfo: record, therapyType });
}

/* ********************************* *
 * Convenient private methods        *
 * ********************************* */
const findSpecimen = (donor: Donor, specimenId: string) => {
  return _.find(donor.specimens, ['submitterId', specimenId]);
};

const findTreatment = (donor: Donor, treatmentId: string): Treatment | undefined => {
  let treatment = undefined;
  if (donor.treatments) {
    treatment = donor.treatments.find(
      tr =>
        tr.clinicalInfo[ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.TREATMENT]] ===
        treatmentId,
    );
  }
  return treatment;
};

const findFollowUp = (donor: Donor, followUpId: string): FollowUp | undefined => {
  let followUp: FollowUp | undefined = undefined;
  if (donor.followUps) {
    followUp = getSingleClinicalObjectFromDonor(donor, ClinicalEntitySchemaNames.FOLLOW_UP, {
      clinicalInfo: {
        [ClinicalUniqueIndentifier[ClinicalEntitySchemaNames.FOLLOW_UP]]: followUpId,
      },
    }) as FollowUp;
  }
  return followUp;
};

const findTherapyWithIdentifier = (
  treatment: Treatment,
  therapyType: ClinicalEntitySchemaNames,
  identiferName: string,
  identiferValue: any,
) => {
  return (treatment.therapies || []).find(
    th => th.clinicalInfo[identiferName] === identiferValue && th.therapyType === therapyType,
  );
};
