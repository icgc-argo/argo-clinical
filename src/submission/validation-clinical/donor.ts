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
import { ClinicalInfo, Donor, Treatment } from '../../clinical/clinical-entities';
import { ClinicalQuery } from '../../clinical/clinical-api';

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
  let errors: SubmissionValidationError[] = []; // all errors for record
  // cross entity donor-specimen record validation
  checkTimeConflictWithSpecimens(submittedDonorClinicalRecord, mergedDonor, errors);

  // other checks here and add to `errors`
  const crossFileErrors = await crossFileValidator(
    submittedDonorClinicalRecord,
    existentDonor,
    mergedDonor,
    submittedRecords,
  );

  errors = [...errors, ...crossFileErrors];

  return { errors };
};

function checkTimeConflictWithSpecimens(
  donorRecord: DeepReadonly<SubmittedClinicalRecord>,
  mergedDonor: DeepReadonly<Donor>,
  errors: SubmissionValidationError[],
) {
  if (
    donorRecord[DonorFieldsEnum.vital_status] !== DonorVitalStatusValues.deceased ||
    !donorRecord[DonorFieldsEnum.survival_time]
  ) {
    return;
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
  if (specimenIdsWithTimeConflicts.length > 0) {
    errors.push(
      utils.buildSubmissionError(
        donorRecord,
        DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        DonorFieldsEnum.survival_time,
        {
          conflictingSpecimenSubmitterIds: specimenIdsWithTimeConflicts,
        },
      ),
    );
  }
}

const crossFileValidator = async (
  submittedDonorRecord: DeepReadonly<SubmittedClinicalRecord>,
  storedDonor: DeepReadonly<Donor> | undefined,
  mergedDonor: DeepReadonly<Donor> | undefined,
  // submitted records needed to validate current submission
  submittedRecords: DeepReadonly<ClinicalSubmissionRecordsByDonorIdMap>,
) => {
  const { lost_to_followup_after_clinical_event_id } = submittedDonorRecord;
  const errors: SubmissionValidationError[] = [];

  const currentDonor = storedDonor || mergedDonor;

  if (currentDonor !== undefined && lost_to_followup_after_clinical_event_id) {
    const { primaryDiagnoses, treatments, followUps } = currentDonor;

    const primaryDiagnosisMatch = primaryDiagnoses?.find(
      followUpRecord =>
        followUpRecord.clinicalInfo?.submitter_primary_diagnosis_id ===
        lost_to_followup_after_clinical_event_id,
    );

    const treatmentMatch = treatments?.find(
      followUpRecord =>
        followUpRecord.clinicalInfo?.submitter_treatment_id ===
        lost_to_followup_after_clinical_event_id,
    );

    const followUpMatch = followUps?.find(
      followUpRecord =>
        followUpRecord.clinicalInfo?.submitter_follow_up_id ===
        lost_to_followup_after_clinical_event_id,
    );

    const entityIdMatch = primaryDiagnosisMatch || treatmentMatch || followUpMatch;

    if (!entityIdMatch) {
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
      const { interval_of_followup } = entityIdMatch;
      console.log('\ninterval_of_followup', interval_of_followup);
      const invalidTreatments = treatments?.filter(treatment => {
        const {
          clinicalInfo: { treatment_start_interval },
        } = treatment;
        return;
      });
    }
  } else {
    // move to top
    // Compare across all Donors
    const programId = 'TEST-CA';
    const query: ClinicalQuery = {
      programShortName: programId,
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
    const { donors } = await donorDao.findByPaginatedProgramId(programId, query);
  }

  return errors;
};
