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
import { ClinicalInfo, Donor } from '../../clinical/clinical-entities';
import { DonorFieldsEnum, SpecimenFieldsEnum } from '../../common-model/entities';
import {
  DataValidationErrors,
  DonorVitalStatusValues,
  SubmissionValidationError,
  SubmissionValidationOutput,
  SubmittedClinicalRecord,
} from '../submission-entities';
import * as utils from './utils';

export const validate = async (
  submittedDonorClinicalRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<SubmissionValidationOutput> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***

  if (!existentDonor || !mergedDonor || !submittedDonorClinicalRecord) {
    throw new Error("Can't call this function without donor & donor record");
  }

  // ***Submission Validation checks***
  // cross entity donor-specimen record validation
  const timeConflictErrors: SubmissionValidationError[] = checkTimeConflictWithSpecimens(
    submittedDonorClinicalRecord,
    mergedDonor,
  );

  // Validation across all submissions and entities
  const crossFileErrors = await crossFileValidator(submittedDonorClinicalRecord, mergedDonor);

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

const getTreatmentInterval = (clinicalInfo: DeepReadonly<ClinicalInfo>) => {
  const {
    interval_of_followup,
    specimen_acquisition_interval,
    treatment_start_interval,
    treatment_duration,
  } = clinicalInfo;

  const treatmentInterval =
    (Number(interval_of_followup) || 0) +
    (Number(specimen_acquisition_interval) || 0) +
    (Number(treatment_start_interval) || 0) +
    (Number(treatment_duration) || 0);

  return treatmentInterval;
};

const crossFileValidator = async (
  submittedDonorRecord: DeepReadonly<SubmittedClinicalRecord>,
  mergedDonor: DeepReadonly<Donor>,
) => {
  const { lost_to_followup_after_clinical_event_id } = submittedDonorRecord;
  const { primaryDiagnoses = [], treatments = [], followUps = [], specimens = [] } = mergedDonor;
  const errors: SubmissionValidationError[] = [];

  if (lost_to_followup_after_clinical_event_id) {
    const treatmentMatch = treatments?.find(
      treatmentRecord =>
        treatmentRecord.clinicalInfo?.submitter_treatment_id ===
        lost_to_followup_after_clinical_event_id,
    );

    const primaryDiagnosisMatch = primaryDiagnoses?.find(
      diagnosisRecord =>
        diagnosisRecord.clinicalInfo?.submitter_primary_diagnosis_id ===
        lost_to_followup_after_clinical_event_id,
    );

    const followUpMatch = followUps?.find(
      followUpRecord =>
        followUpRecord.clinicalInfo?.submitter_follow_up_id ===
        lost_to_followup_after_clinical_event_id,
    );

    // Find if Lost to Follow Up ID matches a previous Treatment ID
    const donorClinicalEventIdMatch = treatmentMatch || primaryDiagnosisMatch || followUpMatch;

    if (!donorClinicalEventIdMatch) {
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
      const lostToFollowUpClinicalInfo = donorClinicalEventIdMatch.clinicalInfo;

      const lostToFollowUpStartInterval =
        Number(
          lostToFollowUpClinicalInfo.interval_of_followup ||
            lostToFollowUpClinicalInfo.treatment_start_interval ||
            lostToFollowUpClinicalInfo.specimen_acquisition_interval,
        ) || 0;

      const lostToFollowUpDuration = Number(lostToFollowUpClinicalInfo.treatment_duration) || 0;

      const lostToFollowUpInterval = lostToFollowUpStartInterval + lostToFollowUpDuration;

      const lost_to_follow_up_diagnosis_id =
        lostToFollowUpClinicalInfo['submitter_primary_diagnosis_id'];

      const clinicalIntervalFilter = (clinicalInfo: DeepReadonly<ClinicalInfo>) =>
        clinicalInfo.submitter_primary_diagnosis_id === lost_to_follow_up_diagnosis_id &&
        getTreatmentInterval(clinicalInfo) > lostToFollowUpInterval;

      // Collect all Treatment, FollowUp + Specimen Records w/ Intervals greater than Lost to Follow Up
      const invalidTreatmentIntervalRecords = treatments
        .map(treatmentRecord => treatmentRecord.clinicalInfo)
        .filter(clinicalIntervalFilter);

      const invalidFollowUpIntervalRecords = followUps
        .map(followUpRecord => followUpRecord.clinicalInfo)
        .filter(clinicalIntervalFilter);

      const invalidSpecimenIntervalRecords = specimens
        .map(specimenRecord => specimenRecord.clinicalInfo)
        .filter(clinicalIntervalFilter);

      const invalidRecords = [
        ...invalidTreatmentIntervalRecords,
        ...invalidFollowUpIntervalRecords,
        ...invalidSpecimenIntervalRecords,
      ];

      for (const invalidClinicalInfo of invalidRecords) {
        const {
          submitter_treatment_id,
          submitter_specimen_id,
          submitter_follow_up_id,
        } = invalidClinicalInfo;
        const treatment_id =
          submitter_treatment_id || submitter_specimen_id || submitter_follow_up_id;

        const submission_type = submitter_treatment_id
          ? 'treatment'
          : submitter_specimen_id
          ? 'specimen'
          : submitter_follow_up_id
          ? 'follow up'
          : 'record';

        errors.push(
          utils.buildSubmissionError(
            submittedDonorRecord,
            DataValidationErrors.INVALID_SUBMISSION_AFTER_LOST_TO_FOLLOW_UP,
            DonorFieldsEnum.lost_to_followup_after_clinical_event_id,
            {
              lost_to_followup_after_clinical_event_id,
              interval_of_followup: lostToFollowUpInterval,
              treatment_id,
              submission_type,
            },
          ),
        );
      }

      // Filter Primary Diagnosis records with Age at Diagnosis greater than age at Lost To Follow Up
      const lostToFollowUpDiagnosisRecord =
        primaryDiagnosisMatch?.clinicalInfo ||
        primaryDiagnoses?.find(
          diagnosisRecord =>
            diagnosisRecord.clinicalInfo?.submitter_primary_diagnosis_id ===
            lost_to_follow_up_diagnosis_id,
        )?.clinicalInfo;

      const lost_to_follow_up_age =
        typeof lostToFollowUpDiagnosisRecord?.age_at_diagnosis === 'number'
          ? lostToFollowUpDiagnosisRecord?.age_at_diagnosis
          : 0;

      const invalidDiagnosisRecords = primaryDiagnoses
        .map(record => record.clinicalInfo)
        .filter(clinicalInfo => {
          const { submitter_primary_diagnosis_id, age_at_diagnosis } = clinicalInfo;
          const ageAtDiagnosis = typeof age_at_diagnosis === 'number' ? age_at_diagnosis : 0;
          return (
            lost_to_follow_up_age &&
            submitter_primary_diagnosis_id !== lost_to_follow_up_diagnosis_id &&
            ageAtDiagnosis > lost_to_follow_up_age
          );
        });

      for (const invalidClinicalInfo of invalidDiagnosisRecords) {
        const { submitter_primary_diagnosis_id } = invalidClinicalInfo;

        errors.push(
          utils.buildSubmissionError(
            submittedDonorRecord,
            DataValidationErrors.INVALID_DIAGNOSIS_AFTER_LOST_TO_FOLLOW_UP,
            DonorFieldsEnum.lost_to_followup_after_clinical_event_id,
            {
              lost_to_follow_up_diagnosis_id,
              lost_to_follow_up_age,
              submitter_primary_diagnosis_id,
            },
          ),
        );
      }
    }
  }

  return errors;
};
