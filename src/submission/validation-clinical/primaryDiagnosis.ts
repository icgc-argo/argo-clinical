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
  SubmissionValidationOutput,
  DataValidationErrors,
} from '../submission-entities';
import {
  ClinicalEntitySchemaNames,
  PrimaryDiagnosisFieldsEnum,
  SpecimenFieldsEnum,
} from '../../common-model/entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Specimen } from '../../clinical/clinical-entities';
import _ from 'lodash';
import {
  getClinicalEntitiesFromDonorBySchemaName,
  getClinicalObjectsFromDonor,
} from '../../common-model/functions';
import { buildSubmissionError, checkClinicalEntityDoesntBelongToOtherDonor } from './utils';
import { isEmpty } from '../../utils';

export const validate = async (
  primaryDiagnosisRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<SubmissionValidationOutput> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  if (!primaryDiagnosisRecord || !existentDonor || !mergedDonor) {
    throw new Error("Can't call this function without primary diagnosis records");
  }

  const errors: SubmissionValidationError[] = [];
  const primaryDiagnosisClinicalInfo = getExisting(existentDonor, primaryDiagnosisRecord);

  // adding new primary diagnosis to this donor ?
  if (!primaryDiagnosisClinicalInfo) {
    // check it is unique in this program
    await checkClinicalEntityDoesntBelongToOtherDonor(
      ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
      primaryDiagnosisRecord,
      existentDonor,
      errors,
    );
  }

  checkRequiredFields(primaryDiagnosisRecord, mergedDonor, errors);

  return { errors };
};

// Either specimen or primary diagnosis must have pathological_tumour_staging_system field or clinical_tumour_staging_system fields:
const checkRequiredFields = (
  primaryDiagnosisRecord: DeepReadonly<SubmittedClinicalRecord>,
  mergedDonor: DeepReadonly<Donor>,
  errors: SubmissionValidationError[],
) => {
  const specimens = getClinicalObjectsFromDonor(
    mergedDonor,
    ClinicalEntitySchemaNames.SPECIMEN,
  ) as [Specimen];

  const specimenEntities = specimens.filter(specimen => {
    return (
      specimen.tumourNormalDesignation === 'Tumour' &&
      specimen.clinicalInfo[SpecimenFieldsEnum.submitter_primary_diagnosis_id] ===
        primaryDiagnosisRecord[PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id]
    );
  });

  for (const specimen of specimenEntities) {
    if (
      isEmpty(specimen.clinicalInfo[SpecimenFieldsEnum.pathological_tumour_staging_system]) &&
      isEmpty(primaryDiagnosisRecord[PrimaryDiagnosisFieldsEnum.clinical_tumour_staging_system])
    ) {
      errors.push(
        buildSubmissionError(
          primaryDiagnosisRecord,
          DataValidationErrors.TNM_STAGING_FIELDS_MISSING,
          PrimaryDiagnosisFieldsEnum.clinical_tumour_staging_system,
          {
            submitter_primary_diagnosis_id:
              primaryDiagnosisRecord[PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id],
          },
        ),
      );
    }
  }
};

function getExisting(
  existingDonor: DeepReadonly<Donor>,
  record: DeepReadonly<SubmittedClinicalRecord>,
) {
  if (existingDonor.primaryDiagnoses) {
    return getClinicalEntitiesFromDonorBySchemaName(
      existingDonor,
      ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
    ).find(
      ci =>
        ci[PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id] ==
        record[PrimaryDiagnosisFieldsEnum.submitter_primary_diagnosis_id],
    );
  }
  return undefined;
}
