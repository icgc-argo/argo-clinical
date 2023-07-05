/*
 * Copyright (c) 2023 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { DeepReadonly } from 'deep-freeze';
import {
  Donor,
  Treatment,
  ClinicalInfo,
  FollowUp,
  Therapy,
  ClinicalEntity,
  PrimaryDiagnosis,
  FamilyHistory,
  Exposure,
  Comorbidity,
  Biomarker,
} from '../../clinical/clinical-entities';
import { ActiveClinicalSubmission, SubmittedClinicalRecordsMap } from '../submission-entities';
import _ from 'lodash';
import { loggerFor } from '../../logger';
import { Errors } from '../../utils';
import { treatmentTypeNotMatchTherapyType } from '../validation-clinical/utils';
import { getSingleClinicalObjectFromDonor } from '../../common-model/functions';
import { updateDonorStatsFromSubmissionCommit } from './stat-calculator';
import {
  ClinicalEntitySchemaNames,
  ClinicalUniqueIdentifier,
  ClinicalTherapySchemaNames,
  DonorFieldsEnum,
  ClinicalTherapyType,
  TreatmentFieldsEnum,
} from '../../common-model/entities';

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
      let entityWithUpdatedInfo: ClinicalEntity | Donor | undefined = { clinicalInfo: {} };
      switch (entityType) {
        case ClinicalEntitySchemaNames.DONOR:
          entityWithUpdatedInfo = updateDonorInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.SPECIMEN:
          entityWithUpdatedInfo = updateSpecimenInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS:
          entityWithUpdatedInfo = updatePrimaryDiagnosisInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.FAMILY_HISTORY:
          entityWithUpdatedInfo = updateFamilyHistoryInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.EXPOSURE:
          entityWithUpdatedInfo = updateExposureInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.COMORBIDITY:
          entityWithUpdatedInfo = updateComorbidityInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.BIOMARKER:
          entityWithUpdatedInfo = updateBiomarkerInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.TREATMENT:
          entityWithUpdatedInfo = updateOrAddTreatementInfo(donor, record);
          break;
        case ClinicalEntitySchemaNames.FOLLOW_UP:
          entityWithUpdatedInfo = updateOrAddFollowUpInfo(donor, record);
          break;
        case ClinicalTherapySchemaNames.find(tsn => tsn === entityType):
          entityWithUpdatedInfo = updateOrAddTherapyInfoInDonor(donor, record, entityType, true);
          break;
        default:
          throw new Error(`Entity ${entityType} not implemented yet`);
      }

      // update clinical entity stats
      updateDonorStatsFromSubmissionCommit(donor, entityType);
    });
  }

  return updatedDonors;
};

// This function will return a merged donor of records mapped by clinical type and the DB existentDonor
export const mergeRecordsMapIntoDonor = (
  unmutableSubmittedRecordsMap: DeepReadonly<SubmittedClinicalRecordsMap>,
  existentDonor: DeepReadonly<Donor>,
) => {
  const submittedRecordsMap = _.cloneDeep(
    unmutableSubmittedRecordsMap,
  ) as SubmittedClinicalRecordsMap;
  const mergedDonor = (_.cloneDeep(existentDonor) || {}) as Donor;

  submittedRecordsMap[ClinicalEntitySchemaNames.DONOR]?.forEach(r =>
    updateDonorInfo(mergedDonor, r),
  );

  submittedRecordsMap[ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS]?.forEach(r =>
    updatePrimaryDiagnosisInfo(mergedDonor, r),
  );

  submittedRecordsMap[ClinicalEntitySchemaNames.FAMILY_HISTORY]?.forEach(r =>
    updateFamilyHistoryInfo(mergedDonor, r),
  );

  submittedRecordsMap[ClinicalEntitySchemaNames.COMORBIDITY]?.forEach(r =>
    updateComorbidityInfo(mergedDonor, r),
  );

  submittedRecordsMap[ClinicalEntitySchemaNames.EXPOSURE]?.forEach(r =>
    updateExposureInfo(mergedDonor, r),
  );

  submittedRecordsMap[ClinicalEntitySchemaNames.BIOMARKER]?.forEach(r =>
    updateBiomarkerInfo(mergedDonor, r),
  );

  submittedRecordsMap[ClinicalEntitySchemaNames.SPECIMEN]?.forEach(r =>
    updateSpecimenInfo(mergedDonor, r),
  );

  submittedRecordsMap[ClinicalEntitySchemaNames.TREATMENT]?.forEach(r =>
    updateOrAddTreatementInfo(mergedDonor, r),
  );

  ClinicalTherapySchemaNames.forEach(tsn =>
    submittedRecordsMap[tsn]?.forEach(r => updateOrAddTherapyInfoInDonor(mergedDonor, r, tsn)),
  );

  submittedRecordsMap[ClinicalEntitySchemaNames.FOLLOW_UP]?.forEach(r =>
    updateOrAddFollowUpInfo(mergedDonor, r),
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
  let primaryDiagnosis = findPrimaryDiagnosis(donor, record);
  if (!primaryDiagnosis) {
    primaryDiagnosis = addNewPrimaryDiagnosisObj(donor);
  }
  primaryDiagnosis.clinicalInfo = record;
  return primaryDiagnosis;
};

const updateFamilyHistoryInfo = (donor: Donor, record: ClinicalInfo) => {
  let familyHistory = findFamilyHistory(donor, record);
  if (!familyHistory) {
    familyHistory = addNewFamilyHistoryObj(donor);
  }
  familyHistory.clinicalInfo = record;
  return familyHistory;
};

const updateExposureInfo = (donor: Donor, record: ClinicalInfo) => {
  let exposure = findExposure(donor, record);
  if (!exposure) {
    exposure = addNewExposureObj(donor);
  }
  exposure.clinicalInfo = record;
  return exposure;
};

const updateBiomarkerInfo = (donor: Donor, record: ClinicalInfo) => {
  let biomarker = findBiomarker(donor, record);
  if (!biomarker) {
    biomarker = addNewBiomarkerObj(donor);
  }
  biomarker.clinicalInfo = record;
  return biomarker;
};

const updateComorbidityInfo = (donor: Donor, record: ClinicalInfo) => {
  let comorbidity = findComorbidity(donor, record);
  if (!comorbidity) {
    comorbidity = addNewComorbidityObj(donor);
  }
  comorbidity.clinicalInfo = record;
  return comorbidity;
};

const updateSpecimenInfo = (donor: Donor, record: ClinicalInfo) => {
  const specimen = findSpecimen(donor, record);
  if (!specimen) return;
  specimen.clinicalInfo = record;
  return specimen;
};

const updateOrAddFollowUpInfo = (donor: Donor, record: ClinicalInfo) => {
  let followUp = findFollowUp(donor, record);
  if (!followUp) {
    followUp = addNewFollowUpObj(donor);
  }
  followUp.clinicalInfo = record;
  return followUp;
};

const updateOrAddTreatementInfo = (donor: Donor, record: ClinicalInfo): Treatment => {
  let treatment = findTreatment(donor, record);
  if (!treatment) {
    treatment = addNewTreatmentObj(donor);
  }
  treatment.clinicalInfo = record;

  // remove any therapy that no longer exists in the treatment type lists if any
  _.remove(treatment.therapies, (therapy: Therapy) => {
    const treatmentTypes = treatment.clinicalInfo[TreatmentFieldsEnum.treatment_type] as string[];
    if (treatmentTypes == undefined) return;
    return treatmentTypeNotMatchTherapyType(
      treatmentTypes,
      therapy.therapyType as ClinicalTherapyType,
    );
  });

  return treatment;
};

const updateOrAddTherapyInfoInDonor = (
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
  return updateOrAddTherapyInfoInTreatment(treatment, record, therapyType as ClinicalTherapyType);
};

const updateOrAddTherapyInfoInTreatment = (
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

/*** Clinical object finders ***/
const findSpecimen = (donor: Donor, record: ClinicalInfo) => {
  const specimenId = record[ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.SPECIMEN]];
  return _.find(donor.specimens, ['submitterId', specimenId]);
};

const findTreatment = (donor: Donor, record: ClinicalInfo) => {
  return findClinicalObject(donor, record, ClinicalEntitySchemaNames.TREATMENT) as Treatment;
};

const findFollowUp = (donor: Donor, record: ClinicalInfo) => {
  return findClinicalObject(donor, record, ClinicalEntitySchemaNames.FOLLOW_UP) as FollowUp;
};

const findPrimaryDiagnosis = (donor: Donor, record: ClinicalInfo) => {
  return findClinicalObject(donor, record, ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS);
};

const findFamilyHistory = (donor: Donor, record: ClinicalInfo) => {
  return findFamilyHistoryObj(donor, record);
};

const findComorbidity = (donor: Donor, record: ClinicalInfo) => {
  return findComorbidityObj(donor, record);
};

const findExposure = (donor: Donor, record: ClinicalInfo) => {
  return findClinicalObject(donor, record, ClinicalEntitySchemaNames.EXPOSURE);
};

const findClinicalObject = (
  donor: Donor,
  newRecord: ClinicalInfo,
  entityType: Exclude<
    ClinicalEntitySchemaNames,
    | ClinicalTherapyType
    | ClinicalEntitySchemaNames.FAMILY_HISTORY
    | ClinicalEntitySchemaNames.REGISTRATION
    | ClinicalEntitySchemaNames.COMORBIDITY
    | ClinicalEntitySchemaNames.BIOMARKER
  >,
): ClinicalEntity | undefined => {
  const uniqueIdName = ClinicalUniqueIdentifier[entityType];
  const uniqueIdValue = newRecord[uniqueIdName];
  return getSingleClinicalObjectFromDonor(donor, entityType, {
    clinicalInfo: { [uniqueIdName]: uniqueIdValue },
  }) as ClinicalEntity | undefined;
};

const findTherapy = (
  treatment: Treatment,
  record: ClinicalInfo,
  therapyType: ClinicalTherapyType,
): Therapy | undefined => {
  // therapy clinicalinfo have multiple fields needed to find them
  const uniqueIdNames = ClinicalUniqueIdentifier[therapyType];
  const constraints: ClinicalInfo = {};
  uniqueIdNames.forEach(idN => (constraints[idN] = record[idN]));

  return _(treatment.therapies || []).find({ clinicalInfo: constraints, therapyType });
};

const findFamilyHistoryObj = (donor: Donor, record: ClinicalInfo): ClinicalEntity | undefined => {
  const uniqueIdNames = ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.FAMILY_HISTORY];
  const constraints: ClinicalInfo = {};
  uniqueIdNames.forEach(idN => (constraints[idN] = record[idN]));

  return _(donor.familyHistory || []).find({ clinicalInfo: constraints });
};

const findComorbidityObj = (donor: Donor, record: ClinicalInfo): ClinicalEntity | undefined => {
  const uniqueIdNames = ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.COMORBIDITY];
  const constraints: ClinicalInfo = {};
  uniqueIdNames.forEach(idN => (constraints[idN] = record[idN]));

  return _(donor.comorbidity || []).find({ clinicalInfo: constraints });
};

const findBiomarker = (donor: Donor, record: ClinicalInfo): ClinicalEntity | undefined => {
  const uniqueIdNames = ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.BIOMARKER];
  const constraints: ClinicalInfo = {};
  uniqueIdNames.forEach(idN => (constraints[idN] = record[idN]));

  return _(donor.biomarker || []).find({ clinicalInfo: constraints });
};

/*** Empty clinical object adders ***/
const addNewTreatmentObj = (donor: Donor): Treatment => {
  const newTreatement = { clinicalInfo: {}, therapies: [], treatmentId: undefined } as Treatment;
  donor.treatments = _.concat(donor.treatments || [], newTreatement);
  return _.last(donor.treatments) as Treatment;
};

const addNewFollowUpObj = (donor: Donor): FollowUp => {
  const newFollowUp = { clinicalInfo: {}, followUpId: undefined } as FollowUp;
  donor.followUps = _.concat(donor.followUps || [], newFollowUp);
  return _.last(donor.followUps) as FollowUp;
};

const addNewPrimaryDiagnosisObj = (donor: Donor): ClinicalEntity => {
  const newPrimaryDiag = { clinicalInfo: {}, primaryDiagnosisId: undefined } as PrimaryDiagnosis;
  donor.primaryDiagnoses = _.concat(donor.primaryDiagnoses || [], newPrimaryDiag);
  return _.last(donor.primaryDiagnoses) as PrimaryDiagnosis;
};

const addNewFamilyHistoryObj = (donor: Donor): ClinicalEntity => {
  const newFamilyHistory = { clinicalInfo: {}, familyHistoryId: undefined } as FamilyHistory;
  donor.familyHistory = _.concat(donor.familyHistory || [], newFamilyHistory);
  return _.last(donor.familyHistory) as FamilyHistory;
};

const addNewExposureObj = (donor: Donor): ClinicalEntity => {
  const newExposure = { clinicalInfo: {}, exposureId: undefined } as Exposure;
  donor.exposure = _.concat(donor.exposure || [], newExposure);
  return _.last(donor.exposure) as Exposure;
};

const addNewBiomarkerObj = (donor: Donor): ClinicalEntity => {
  const newBiomarker = { clinicalInfo: {}, biomarkerId: undefined } as Biomarker;
  donor.biomarker = _.concat(donor.biomarker || [], newBiomarker);
  return _.last(donor.biomarker) as Biomarker;
};

const addNewComorbidityObj = (donor: Donor): ClinicalEntity => {
  const newComorbidity = { clinicalInfo: {}, comorbidityId: undefined } as Comorbidity;
  donor.comorbidity = _.concat(donor.comorbidity || [], newComorbidity);
  return _.last(donor.comorbidity) as Comorbidity;
};

const addNewTherapyObj = (treatment: Treatment, therapyType: ClinicalTherapyType): Therapy => {
  const newTherapy = { clinicalInfo: {}, therapyType };
  treatment.therapies.push(newTherapy);
  return _.last(treatment.therapies) as Therapy;
};
