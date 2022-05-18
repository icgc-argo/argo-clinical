/*
 * Copyright (c) 2022 The Ontario Institute for Cancer Research. All rights reserved
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

import { Donor, Therapy } from '../../clinical/clinical-entities';
import {
  DataValidationErrors,
  SubmissionValidationError,
  SubmissionValidationOutput,
  SubmittedClinicalRecord,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { getSingleClinicalObjectFromDonor } from '../../common-model/functions';
import {
  ClinicalEntitySchemaNames,
  CommonTherapyFields,
  SurgeryFieldsEnum,
} from '../../common-model/entities';
import { checkTreatementHasCorrectTypeForTherapy, getTreatment } from './therapy';
import * as utils from './utils';

export const validate = async (
  therapyRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<SubmissionValidationOutput> => {
  if (!therapyRecord || !mergedDonor || !existentDonor) {
    throw new Error("Can't call this function without a registerd donor & therapy record");
  }
  const errors: SubmissionValidationError[] = [];

  const treatment = getTreatment(therapyRecord, mergedDonor, errors);
  if (!treatment) return { errors };
  checkTreatementHasCorrectTypeForTherapy(therapyRecord, treatment, errors);

  // 1. if sub_sp_id is submitted in tsv?
  if (therapyRecord[SurgeryFieldsEnum.submitter_specimen_id]) {
    // get existing surgery by submitter_specimen_id
    const specimenId = therapyRecord[SurgeryFieldsEnum.submitter_specimen_id];
    const existingSurgeryBySpecimenId = getSingleClinicalObjectFromDonor(
      existentDonor,
      ClinicalEntitySchemaNames.SURGERY,
      {
        clinicalInfo: {
          [SurgeryFieldsEnum.submitter_specimen_id]: specimenId as string,
        },
      },
    ) as DeepReadonly<Therapy>;

    if (existingSurgeryBySpecimenId) {
      // Has sub_sp_id been submitted in surgery before? if yes, then invalid
      errors.push(
        utils.buildSubmissionError(
          therapyRecord,
          DataValidationErrors.DUPLICATE_SUBMITTER_SPECIMEN_ID_IN_SURGERY,
          SurgeryFieldsEnum.submitter_specimen_id,
        ),
      );
    } else {
      // ---- This section can be reused for the case when  sub_sp_id is submitted in not in tsv
      // if sub_sp_id has not been submitted, contine check
      const submitterDonorId = therapyRecord[CommonTherapyFields.submitter_donor_id];
      const sumitterTreatmentId = therapyRecord[CommonTherapyFields.submitter_treatment_id];
      const existingSurgery = getSingleClinicalObjectFromDonor(
        existentDonor,
        ClinicalEntitySchemaNames.SURGERY,
        {
          clinicalInfo: {
            [CommonTherapyFields.submitter_donor_id]: submitterDonorId as string,
            [CommonTherapyFields.submitter_treatment_id]: sumitterTreatmentId as string,
          },
        },
      ) as DeepReadonly<Therapy>;

      if (existingSurgery) {
        // check if existing surgery'surgery_type == therapyRecord.surgery_type
        const existingSurgeryType = existingSurgery.clinicalInfo[
          SurgeryFieldsEnum.surgery_type
        ] as string;
        const therapyRecordSurgeryType = therapyRecord[SurgeryFieldsEnum.surgery_type] as string;
        if (existingSurgeryType === therapyRecordSurgeryType) {
          // valid
        } else {
          errors.push(
            utils.buildSubmissionError(
              therapyRecord,
              DataValidationErrors.SURGERY_TYPES_NOT_EQUAL,
              SurgeryFieldsEnum.submitter_specimen_id,
            ),
          );
        }
      } else {
        // no existing surgery, valid, do nothing.
      }
    }
  } else {
    const submitterDonorId = therapyRecord[CommonTherapyFields.submitter_donor_id];
    const sumitterTreatmentId = therapyRecord[CommonTherapyFields.submitter_treatment_id];
    const existingSurgery = getSingleClinicalObjectFromDonor(
      existentDonor,
      ClinicalEntitySchemaNames.SURGERY,
      {
        clinicalInfo: {
          [CommonTherapyFields.submitter_donor_id]: submitterDonorId as string,
          [CommonTherapyFields.submitter_treatment_id]: sumitterTreatmentId as string,
        },
      },
    ) as DeepReadonly<Therapy>;

    if (existingSurgery) {
      const existingSurgeryType = existingSurgery.clinicalInfo[
        SurgeryFieldsEnum.surgery_type
      ] as string;
      const therapyRecordSurgeryType = therapyRecord[SurgeryFieldsEnum.surgery_type] as string;

      if (existingSurgeryType === therapyRecordSurgeryType) {
        // valid
      } else {
        errors.push(
          utils.buildSubmissionError(
            therapyRecord,
            DataValidationErrors.SURGERY_TYPES_NOT_EQUAL,
            SurgeryFieldsEnum.submitter_specimen_id,
          ),
        );
      }
    } else {
      // valid
    }
  }

  return { errors };
};
