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

import {
  SubmissionValidationError,
  SubmittedClinicalRecord,
  DataValidationErrors,
  SubmissionValidationOutput,
} from '../submission-entities';
import {
  ClinicalEntitySchemaNames,
  TreatmentFieldsEnum,
  ClinicalTherapyType,
} from '../../common-model/entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Treatment } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { getSingleClinicalObjectFromDonor } from '../../common-model/functions';
import { isValueEqual } from '../../utils';

export const validate = async (
  therapyRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<SubmissionValidationOutput> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  if (!therapyRecord || !mergedDonor || !existentDonor) {
    throw new Error("Can't call this function without a registerd donor & therapy record");
  }

  const errors: SubmissionValidationError[] = [];
  const treatment = getTreatment(therapyRecord, mergedDonor, errors);
  if (!treatment) return { errors };
  checkTreatementHasCorrectTypeForTherapy(therapyRecord, treatment, errors);
  return { errors };
};

function checkTreatementHasCorrectTypeForTherapy(
  therapyRecord: DeepReadonly<SubmittedClinicalRecord>,
  treatment: DeepReadonly<Treatment>,
  errors: SubmissionValidationError[],
) {
  const treatmentType = treatment.clinicalInfo[TreatmentFieldsEnum.treatment_type] as string[];
  const therapyType = treatment.therapies.find(therapy =>
    isValueEqual(therapy.clinicalInfo, therapyRecord),
  )?.therapyType;

  if (utils.treatmentTypeNotMatchTherapyType(treatmentType, therapyType as ClinicalTherapyType)) {
    errors.push(
      utils.buildSubmissionError(
        therapyRecord,
        DataValidationErrors.INCOMPATIBLE_PARENT_TREATMENT_TYPE,
        TreatmentFieldsEnum.submitter_treatment_id,
        {
          [TreatmentFieldsEnum.treatment_type]: treatmentType,
          therapyType,
        },
      ),
    );
  }
}

function getTreatment(
  therapyRecord: DeepReadonly<SubmittedClinicalRecord>,
  mergedDonor: Donor,
  errors: SubmissionValidationError[],
) {
  const treatmentId = therapyRecord[TreatmentFieldsEnum.submitter_treatment_id];
  const treatment = getSingleClinicalObjectFromDonor(
    mergedDonor,
    ClinicalEntitySchemaNames.TREATMENT,
    { clinicalInfo: { [TreatmentFieldsEnum.submitter_treatment_id]: treatmentId as string } },
  ) as DeepReadonly<Treatment>;
  if (!treatment || treatment.clinicalInfo === {}) {
    errors.push(
      utils.buildSubmissionError(
        therapyRecord,
        DataValidationErrors.TREATMENT_ID_NOT_FOUND,
        TreatmentFieldsEnum.submitter_treatment_id,
      ),
    );
    return undefined;
  }

  return treatment;
}
