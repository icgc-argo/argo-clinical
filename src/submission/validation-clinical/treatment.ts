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
  ClinicalUniqueIdentifier,
  TreatmentFieldsEnum,
  ClinicalTherapyType,
  ClinicalTherapySchemaNames,
} from '../../common-model/entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Treatment } from '../../clinical/clinical-entities';
import * as utils from './utils';
import _ from 'lodash';
import { getSingleClinicalObjectFromDonor } from '../../common-model/functions';
import { checkClinicalEntityDoesntBelongToOtherDonor, checkRelatedEntityExists } from './utils';

export const validate = async (
  treatmentRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<SubmissionValidationOutput> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  if (!treatmentRecord || !existentDonor || !mergedDonor) {
    throw new Error("Can't call this function without a registerd donor & treatment record");
  }
  const errors: SubmissionValidationError[] = [];
  await checkTreatmentDoesntBelongToOtherDonor(treatmentRecord, existentDonor, errors);

  // order is important here if the previous treatment is good we take time
  // to validate therapies
  const validateTherapies = errors.length == 0;
  if (validateTherapies) {
    for (const therapyName of ClinicalTherapySchemaNames) {
      checkTherapyFileNeeded(treatmentRecord, mergedDonor, therapyName, errors);
    }
  }

  // validate primary diagnosis exists
  checkRelatedEntityExists(
    ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
    treatmentRecord,
    ClinicalEntitySchemaNames.TREATMENT,
    mergedDonor,
    errors,
    true,
  );

  const warnings: SubmissionValidationError[] = [];
  checkForDeletedTreatmentTherapies(treatmentRecord, existentDonor, warnings);

  return { errors, warnings: warnings };
};

async function checkTreatmentDoesntBelongToOtherDonor(
  treatmentRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  errors: SubmissionValidationError[],
) {
  const treatment = getTreatment(treatmentRecord, existentDonor);
  // if treatment isn't present in this existentDonor, it could exist in another donor
  if (!treatment) {
    await checkClinicalEntityDoesntBelongToOtherDonor(
      ClinicalEntitySchemaNames.TREATMENT,
      treatmentRecord,
      existentDonor,
      errors,
    );
  }
}

function checkForDeletedTreatmentTherapies(
  treatmentRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  warnings: SubmissionValidationError[],
) {
  const treatment = getTreatment(treatmentRecord, existentDonor);
  // treatment not created yet. no need to check then
  if (treatment == undefined) {
    return;
  }
  // if treatment isn't present in this existentDonor, it could exist in another donor
  if (
    treatment.clinicalInfo[TreatmentFieldsEnum.treatment_type] !=
    treatmentRecord[TreatmentFieldsEnum.treatment_type]
  ) {
    const deleted = _.difference(
      treatment.clinicalInfo[TreatmentFieldsEnum.treatment_type] as string[],
      treatmentRecord[TreatmentFieldsEnum.treatment_type] as any,
    );
    warnings.push(
      utils.buildSubmissionWarning(
        treatmentRecord,
        DataValidationErrors.DELETING_THERAPY,
        TreatmentFieldsEnum.treatment_type,
        { deleted },
      ),
    );
  }
}

function checkTherapyFileNeeded(
  treatmentRecord: DeepReadonly<SubmittedClinicalRecord>,
  mergedDonor: Donor,
  therapyType: ClinicalTherapyType,
  errors: SubmissionValidationError[],
) {
  const treatmentType = treatmentRecord[TreatmentFieldsEnum.treatment_type] as string[];
  if (utils.treatmentTypeNotMatchTherapyType(treatmentType, therapyType)) return;

  const treatment = getTreatment(treatmentRecord, mergedDonor);
  if (!treatment) throw new Error('Missing treatment, shouldnt be possible');

  if (
    treatment.therapies.length === 0 ||
    !treatment.therapies.some(th => th.therapyType === therapyType)
  ) {
    errors.push(
      utils.buildSubmissionError(
        treatmentRecord,
        DataValidationErrors.MISSING_THERAPY_DATA,
        TreatmentFieldsEnum.treatment_type,
        { therapyType },
      ),
    );
  }
}

function getTreatment(
  treatmentRecord: DeepReadonly<SubmittedClinicalRecord>,
  donor: DeepReadonly<Donor>,
) {
  const idFieldName = ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.TREATMENT];
  const treatmentId = treatmentRecord[idFieldName];

  return getSingleClinicalObjectFromDonor(donor, ClinicalEntitySchemaNames.TREATMENT, {
    clinicalInfo: { [idFieldName]: treatmentId as string },
  }) as DeepReadonly<Treatment>;
}
