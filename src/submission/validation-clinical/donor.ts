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

import _ from 'lodash';
import { DeepReadonly } from 'deep-freeze';
import * as utils from './utils';
import {
  ClinicalSubmissionRecordsByDonorIdMap,
  DataValidationErrors,
  DonorVitalStatusValues,
  SubmittedClinicalRecord,
  SubmissionValidationError,
  SubmissionValidationOutput,
} from '../submission-entities';
import {
  DonorFieldsEnum,
  ClinicalEntitySchemaNames,
  SpecimenFieldsEnum,
} from '../../common-model/entities';
import { donorDao } from '../../clinical/donor-repo';
import {
  ClinicalInfo,
  Donor,
  FollowUp,
  PrimaryDiagnosis,
  Treatment,
} from '../../clinical/clinical-entities';
import { ClinicalQuery } from '../../clinical/clinical-api';
import { notEmpty } from '../../utils';

export const validate = async (
  submittedDonorClinicalRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
  submittedRecords: DeepReadonly<ClinicalSubmissionRecordsByDonorIdMap>,
): Promise<SubmissionValidationOutput> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***

  if (!existentDonor || !mergedDonor || !submittedDonorClinicalRecord) {
    throw new Error("Can't call this function without donor & donor record");
  }

  const { programId } = existentDonor || mergedDonor;

  // ***Submission Validation checks***
  // cross entity donor-specimen record validation
  const timeConflictErrors: SubmissionValidationError[] = checkTimeConflictWithSpecimens(
    submittedDonorClinicalRecord,
    mergedDonor,
  );

  // Validation across all submissions and entities
  const crossFileErrors = await crossFileValidator(
    submittedDonorClinicalRecord,
    submittedRecords,
    mergedDonor,
    programId,
  );

  return { errors: [...timeConflictErrors, ...crossFileErrors] };
};

function checkTimeConflictWithSpecimens(
  donorRecord: DeepReadonly<SubmittedClinicalRecord>,
  mergedDonor: DeepReadonly<Donor>,
) {
  if (
    donorRecord[DonorFieldsEnum.vital_status] !== DonorVitalStatusValues.deceased ||
    !donorRecord[DonorFieldsEnum.survival_time]
  ) {
    return [];
  }
  const specimenIdsWithTimeConflicts: string[] = [];
  const donorSurvivalTime: number = Number(donorRecord[DonorFieldsEnum.survival_time]);

  mergedDonor.specimens.forEach(specimen => {
    let specimenAcqusitionInterval: number = 0;
    if (specimen.clinicalInfo) {
      specimenAcqusitionInterval = Number(
        specimen.clinicalInfo[SpecimenFieldsEnum.specimen_acquisition_interval],
      );
    } else {
      return; // no specimenAcqusitionInterval so move on to next specimen
    }

    if (donorSurvivalTime < specimenAcqusitionInterval) {
      specimenIdsWithTimeConflicts.push(specimen.submitterId);
    }
  });

  // check if any conflicts found
  return specimenIdsWithTimeConflicts.length > 0
    ? [
        utils.buildSubmissionError(
          donorRecord,
          DataValidationErrors.CONFLICTING_TIME_INTERVAL,
          DonorFieldsEnum.survival_time,
          {
            conflictingSpecimenSubmitterIds: specimenIdsWithTimeConflicts,
          },
        ),
      ]
    : [];
}

const crossFileValidator = async (
  submittedDonorRecord: DeepReadonly<SubmittedClinicalRecord>,
  // Submitted records needed to validate across records
  submittedRecords: DeepReadonly<ClinicalSubmissionRecordsByDonorIdMap>,
  mergedDonor: DeepReadonly<Donor>,
  programShortName: string,
) => {
  const { lost_to_followup_after_clinical_event_id } = submittedDonorRecord;
  const { primaryDiagnoses, treatments, followUps } = mergedDonor;
  const errors: SubmissionValidationError[] = [];

  const donorTreatments = typeof treatments !== 'undefined' ? treatments : [];
  const donorPrimaryDiagnoses = typeof primaryDiagnoses !== 'undefined' ? primaryDiagnoses : [];
  const donorFollowUps = typeof followUps !== 'undefined' ? followUps : [];

  // Compare across other Submissions
  let submittedTreatments: DeepReadonly<ClinicalInfo>[] = [];
  let submittedPrimaryDiagnoses: DeepReadonly<ClinicalInfo>[] = [];
  let submittedFollowUps: DeepReadonly<ClinicalInfo>[] = [];

  for (const donorId in submittedRecords) {
    const submittedTreatmentRecords = submittedRecords[donorId].treatment || [];
    const submittedPrimaryDiagnosisRecords = submittedRecords[donorId].primaryDiagnoses || [];
    const submittedFollowUpRecords = submittedRecords[donorId].followUps || [];

    submittedTreatments = [...submittedTreatments, ...submittedTreatmentRecords];
    submittedPrimaryDiagnoses = [...submittedPrimaryDiagnoses, ...submittedPrimaryDiagnosisRecords];
    submittedFollowUps = [...submittedFollowUps, ...submittedFollowUpRecords];
  }

  // Compare across all Donors in DB
  const query: ClinicalQuery = {
    programShortName,
    entityTypes: [
      ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
      ClinicalEntitySchemaNames.TREATMENT,
      ClinicalEntitySchemaNames.FOLLOW_UP,
    ],
    page: 0,
    sort: 'donorId',
    donorIds: [],
    submitterDonorIds: [],
  };

  const { donors } = await donorDao.findByPaginatedProgramId(programShortName, query);

  const storedTreatments = donors
    .map(donor => donor.treatments)
    .filter((treatments): treatments is Treatment[] => typeof treatments !== 'undefined')
    .flat();

  const storedPrimaryDiagnoses = donors
    .map(donor => donor.primaryDiagnoses)
    .filter((diagnosis): diagnosis is PrimaryDiagnosis[] => typeof diagnosis !== 'undefined')
    .flat();

  const storedFollowUps = donors
    .map(donor => donor.followUps)
    .filter((followUp): followUp is FollowUp[] => typeof followUp !== 'undefined')
    .flat();

  const prevTreatments = [donorTreatments, storedTreatments].flat();

  const prevPrimaryDiagnoses = [donorPrimaryDiagnoses, storedPrimaryDiagnoses].flat();

  const prevFollowUps = [donorFollowUps, storedFollowUps].flat();

  if (lost_to_followup_after_clinical_event_id) {
    const treatmentMatch = prevTreatments?.find(
      treatmentRecord =>
        treatmentRecord.clinicalInfo?.submitter_treatment_id ===
        lost_to_followup_after_clinical_event_id,
    );

    const treatmentSubmissionMatch = submittedTreatments.find(clinicalInfo => {
      clinicalInfo?.submitter_treatment_id === lost_to_followup_after_clinical_event_id;
    });

    const primaryDiagnosisMatch = prevPrimaryDiagnoses?.find(
      primaryDiagnosisRecord =>
        primaryDiagnosisRecord?.clinicalInfo?.submitter_primary_diagnosis_id ===
        lost_to_followup_after_clinical_event_id,
    );

    const diagnosisSubmissionMatch = submittedPrimaryDiagnoses.find(clinicalInfo => {
      clinicalInfo?.submitter_primary_diagnosis_id === lost_to_followup_after_clinical_event_id;
    });

    const followUpMatch = prevFollowUps?.find(
      followUpRecord =>
        followUpRecord.clinicalInfo?.submitter_follow_up_id ===
        lost_to_followup_after_clinical_event_id,
    );

    const followUpSubmissionMatch = submittedFollowUps.find(clinicalInfo => {
      clinicalInfo?.submitter_follow_up_id === lost_to_followup_after_clinical_event_id;
    });

    const prevEntityIdMatch = primaryDiagnosisMatch || treatmentMatch || followUpMatch;
    const submittedIdMatch =
      diagnosisSubmissionMatch || treatmentSubmissionMatch || followUpSubmissionMatch;

    if (!prevEntityIdMatch && !submittedIdMatch) {
      errors.push(
        utils.buildSubmissionError(
          submittedDonorRecord,
          DataValidationErrors.INVALID_LOST_TO_FOLLOW_UP_ID,
          DonorFieldsEnum.lost_to_followup_after_clinical_event_id,
          {
            lost_to_followup_after_clinical_event_id,
          },
        ),
      );
    } else {
      const prevIntervalOfFollowUp =
        (typeof prevEntityIdMatch?.clinicalInfo !== 'undefined' &&
          prevEntityIdMatch.clinicalInfo.interval_of_followup) ||
        0;

      const submittedIntervalOfFollowUp =
        (typeof submittedIdMatch !== 'undefined' && submittedIdMatch.interval_of_followup) || 0;

      const submittedInterval = prevIntervalOfFollowUp
        ? prevIntervalOfFollowUp
        : submittedIntervalOfFollowUp;

      const prevInvalidTreatments = prevTreatments.filter(treatment => {
        const { treatment_start_interval, treatment_duration } = treatment.clinicalInfo
          ? treatment.clinicalInfo
          : treatment;

        const treatmentInterval =
          typeof treatment_start_interval === 'number' ? treatment_start_interval : 0;

        const treatmentDuration = typeof treatment_duration === 'number' ? treatment_duration : 0;

        const totalTreatmentTime = treatmentInterval + treatmentDuration;

        const treatmentInvalid = totalTreatmentTime > submittedInterval;

        return treatmentInvalid;
      });

      if (prevInvalidTreatments.length) {
        const firstTreatmentMatch = prevInvalidTreatments[0];
        const { submitter_treatment_id } = firstTreatmentMatch.clinicalInfo
          ? firstTreatmentMatch.clinicalInfo
          : firstTreatmentMatch;

        errors.push(
          utils.buildSubmissionError(
            submittedDonorRecord,
            DataValidationErrors.INVALID_SUBMISSION_AFTER_LOST_TO_FOLLOW_UP,
            DonorFieldsEnum.lost_to_followup_after_clinical_event_id,
            {
              lost_to_followup_after_clinical_event_id,
              interval_of_followup: submittedInterval,
              submitter_treatment_id,
            },
          ),
        );
      }
    }
  }

  return errors;
};
