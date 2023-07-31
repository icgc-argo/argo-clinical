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
  ClinicalInfo,
  Donor,
  FollowUp,
  PrimaryDiagnosis,
  Treatment,
} from '../../clinical/clinical-entities';
import {
  ClinicalEntitySchemaNames,
  DonorFieldsEnum,
  SpecimenFieldsEnum,
  aliasEntityNames,
} from '../../common-model/entities';
import {
  ClinicalSubmissionRecordsByDonorIdMap,
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
  submittedRecords: DeepReadonly<ClinicalSubmissionRecordsByDonorIdMap>,
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
  const crossFileErrors = await crossFileValidator(
    submittedDonorClinicalRecord,
    submittedRecords,
    mergedDonor,
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
  submittedRecords: DeepReadonly<ClinicalSubmissionRecordsByDonorIdMap>,
  mergedDonor: DeepReadonly<Donor>,
) => {
  const { lost_to_followup_after_clinical_event_id } = submittedDonorRecord;
  const {
    submitterId,
    primaryDiagnoses: donorPrimaryDiagnoses = [],
    treatments: donorTreatments = [],
    followUps: donorFollowUps = [],
  } = mergedDonor;

  const errors: SubmissionValidationError[] = [];

  const submittedDonor = submittedRecords[submitterId];

  const submittedTreatmentRecords: readonly DeepReadonly<SubmittedClinicalRecord>[] =
    submittedDonor.treatment || [];

  const submittedPrimaryDiagnosisRecords: readonly DeepReadonly<SubmittedClinicalRecord>[] =
    submittedDonor.primaryDiagnoses || [];

  const submittedFollowUpRecords: readonly DeepReadonly<SubmittedClinicalRecord>[] =
    submittedDonor.followUps || [];

  if (lost_to_followup_after_clinical_event_id) {
    const treatmentMatch = donorTreatments?.find(
      treatmentRecord =>
        treatmentRecord.clinicalInfo?.submitter_treatment_id ===
        lost_to_followup_after_clinical_event_id,
    );

    const primaryDiagnosisMatch = donorPrimaryDiagnoses?.find(
      primaryDiagnosisRecord =>
        primaryDiagnosisRecord?.clinicalInfo?.submitter_primary_diagnosis_id ===
        lost_to_followup_after_clinical_event_id,
    );

    const followUpMatch = donorFollowUps?.find(
      followUpRecord =>
        followUpRecord.clinicalInfo?.submitter_follow_up_id ===
        lost_to_followup_after_clinical_event_id,
    );

    // Find if Lost to Follow Up ID matches a previous Treatment ID
    const donorClinicalEventIdMatch = treatmentMatch || primaryDiagnosisMatch || followUpMatch;

    const treatmentSubmissionMatch = submittedTreatmentRecords.find(clinicalInfo => {
      clinicalInfo?.submitter_treatment_id === lost_to_followup_after_clinical_event_id;
    });

    const diagnosisSubmissionMatch = submittedPrimaryDiagnosisRecords.find(clinicalInfo => {
      clinicalInfo?.submitter_primary_diagnosis_id === lost_to_followup_after_clinical_event_id;
    });

    const followUpSubmissionMatch = submittedFollowUpRecords.find(clinicalInfo => {
      clinicalInfo?.submitter_follow_up_id === lost_to_followup_after_clinical_event_id;
    });

    // Find New Submitted Records matching submitted Lost to Follow Up ID
    const submittedClinicalEventIdMatch =
      diagnosisSubmissionMatch || treatmentSubmissionMatch || followUpSubmissionMatch;

    if (!donorClinicalEventIdMatch && !submittedClinicalEventIdMatch) {
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
      const donorIntervalOfFollowUp =
        (typeof donorClinicalEventIdMatch?.clinicalInfo?.interval_of_followup === 'number' &&
          donorClinicalEventIdMatch.clinicalInfo.interval_of_followup) ||
        0;

      const submittedIntervalOfFollowUp =
        (typeof submittedClinicalEventIdMatch?.interval_of_followup === 'number' &&
          submittedClinicalEventIdMatch?.interval_of_followup) ||
        0;

      const isTreatmentValid = (
        treatmentInterval = 0,
        treatmentDuration = 0,
        intervalOfFollowUp = 0,
      ) => {
        const totalTreatmentTime = treatmentInterval + treatmentDuration;

        const treatmentIsInvalid = totalTreatmentTime > intervalOfFollowUp;

        return treatmentIsInvalid;
      };

      const invalidDonorTreatments = donorTreatments.filter(treatment => {
        const treatmentRecord = treatment.clinicalInfo;

        const { treatment_start_interval, treatment_duration } = treatmentRecord;

        const treatmentInterval =
          typeof treatment_start_interval === 'number' ? treatment_start_interval : 0;

        const treatmentDuration = typeof treatment_duration === 'number' ? treatment_duration : 0;

        return isTreatmentValid(treatmentInterval, treatmentDuration, donorIntervalOfFollowUp);
      });

      const invalidSubmittedTreatments = submittedTreatmentRecords.filter(treatment => {
        const { treatment_start_interval, treatment_duration } = treatment;

        const treatmentInterval =
          typeof treatment_start_interval === 'number' ? treatment_start_interval : 0;

        const treatmentDuration = typeof treatment_duration === 'number' ? treatment_duration : 0;

        return isTreatmentValid(treatmentInterval, treatmentDuration, submittedIntervalOfFollowUp);
      });

      if (invalidDonorTreatments.length || invalidSubmittedTreatments.length) {
        const firstTreatmentMatch = invalidSubmittedTreatments.length
          ? invalidSubmittedTreatments[0]
          : invalidDonorTreatments[0].clinicalInfo;

        const { submitter_treatment_id } = firstTreatmentMatch;

        errors.push(
          utils.buildSubmissionError(
            submittedDonorRecord,
            DataValidationErrors.INVALID_SUBMISSION_AFTER_LOST_TO_FOLLOW_UP,
            DonorFieldsEnum.lost_to_followup_after_clinical_event_id,
            {
              lost_to_followup_after_clinical_event_id,
              interval_of_followup: donorIntervalOfFollowUp,
              submitter_treatment_id,
            },
          ),
        );
      }
    }
  }

  return errors;
};
