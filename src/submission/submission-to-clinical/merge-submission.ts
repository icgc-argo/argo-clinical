/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
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

// This function will return a merged donor of records mapped by clinical type and the DB exsistentDonor
export const mergeRecordsMapIntoDonor = (
  unmutableSubmittedRecordsMap: DeepReadonly<SubmittedClinicalRecordsMap>,
  exsistentDonor: DeepReadonly<Donor>,
) => {
  const submittedRecordsMap = _.cloneDeep(
    unmutableSubmittedRecordsMap,
  ) as SubmittedClinicalRecordsMap;
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
    treatmentTypeNotMatchTherapyType;
    primaryDiagnosis = addNewPrimaryDiagnosisObj(donor);
  }
  primaryDiagnosis.clinicalInfo = record;
  return primaryDiagnosis;
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

const findClinicalObject = (
  donor: Donor,
  newRecord: ClinicalInfo,
  entityType: Exclude<
    ClinicalEntitySchemaNames,
    ClinicalTherapyType | ClinicalEntitySchemaNames.REGISTRATION
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

const addNewTherapyObj = (treatment: Treatment, therapyType: ClinicalTherapyType): Therapy => {
  const newTherapy = { clinicalInfo: {}, therapyType };
  treatment.therapies.push(newTherapy);
  return _.last(treatment.therapies) as Therapy;
};
