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
  DataValidationErrors,
  SubmittedClinicalRecord,
  DonorVitalStatusValues,
  SampleRegistrationFieldsEnum,
  SubmissionValidationOutput,
} from '../submission-entities';
import {
  ClinicalEntitySchemaNames,
  SpecimenFieldsEnum,
  PrimaryDiagnosisFieldsEnum,
} from '../../common-model/entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, PrimaryDiagnosis, Specimen } from '../../clinical/clinical-entities';
import * as utils from './utils';
import { isEmpty, notEmpty } from '../../utils';
import { getEntitySubmitterIdFieldName } from '../../common-model/functions';
import { checkRelatedEntityExists, getSpecimenFromDonor } from './utils';
import _ from 'lodash';

export const validate = async (
  specimenRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<SubmissionValidationOutput> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***

  if (!specimenRecord || !existentDonor || !mergedDonor) {
    throw new Error("Can't call this function without donor & donor record");
  }

  const errors: SubmissionValidationError[] = []; // all errors for record

  const specimen = getSpecimenFromDonor(existentDonor, specimenRecord, errors);
  if (!specimen) {
    return { errors };
  }

  // Primary diagnosis must exist beccause a specimen needs to be associated with a primary diagnosis
  checkRelatedEntityExists(
    ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
    specimenRecord,
    ClinicalEntitySchemaNames.SPECIMEN,
    mergedDonor,
    errors,
    true,
  );

  // validate allowed/unallowed fields
  checkRequiredFields(specimen, specimenRecord, mergedDonor, errors);

  // validate time conflict if needed
  const donorDataToValidateWith = utils.getDataFromDonorRecordOrDonor(
    specimenRecord,
    mergedDonor,
    errors,
    SpecimenFieldsEnum.specimen_acquisition_interval,
  );

  if (donorDataToValidateWith) {
    checkTimeConflictWithDonor(donorDataToValidateWith, specimenRecord, errors);
  }

  return { errors };
};

function checkTimeConflictWithDonor(
  donorDataToValidateWith: { [k: string]: any },
  specimenRecord: DeepReadonly<SubmittedClinicalRecord>,
  errors: SubmissionValidationError[],
) {
  if (
    donorDataToValidateWith.donorVitalStatus === DonorVitalStatusValues.deceased &&
    donorDataToValidateWith.donorSurvivalTime <
      specimenRecord[SpecimenFieldsEnum.specimen_acquisition_interval]
  ) {
    errors.push(
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.CONFLICTING_TIME_INTERVAL,
        SpecimenFieldsEnum.specimen_acquisition_interval,
        {},
      ),
    );
  }
}

const checkRequiredFields = (
  specimen: DeepReadonly<Specimen>,
  specimenRecord: DeepReadonly<SubmittedClinicalRecord>,
  mergedDonor: Donor,
  errors: SubmissionValidationError[],
) => {
  const requiredFieldsForTumour: Array<keyof typeof SpecimenFieldsEnum> = [
    'tumour_grading_system',
    'tumour_grade',
    'percent_tumour_cells',
    'percent_tumour_cells_measurement_method',
    'tumour_histological_type',
    'reference_pathology_confirmed',
  ];

  const optionalFieldsForTumour: Array<keyof typeof SpecimenFieldsEnum> = [
    'pathological_tumour_staging_system',
    'pathological_stage_group',
    'pathological_t_category',
    'pathological_n_category',
    'pathological_m_category',
    'percent_proliferating_cells',
    'percent_stromal_cells',
    'percent_necrosis',
    'percent_inflammatory_tissue',
  ];

  const errorInfo = {
    submitter_specimen_id: specimenRecord[SpecimenFieldsEnum.submitter_specimen_id],
    referenceSchema: ClinicalEntitySchemaNames.REGISTRATION,
    variableRequirement: {
      fieldName: SampleRegistrationFieldsEnum.tumour_normal_designation,
      fieldValue: specimen.tumourNormalDesignation,
    },
  };

  if (specimen.tumourNormalDesignation === 'Tumour') {
    const missingRequiredFields = requiredFieldsForTumour.filter(field =>
      isEmpty(specimenRecord[field]),
    );

    missingRequiredFields.forEach(field => {
      errors.push(
        utils.buildSubmissionError(
          specimenRecord,
          DataValidationErrors.MISSING_VARIABLE_REQUIREMENT,
          SpecimenFieldsEnum[field],
          errorInfo,
        ),
      );
    });

    // Either specimen or primary diagnosis must have pathological_tumour_staging_system field or clinical_tumour_staging_system fields:
    const entitySubmitterIdField = getEntitySubmitterIdFieldName(
      ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
    );

    const primaryDiagnosisEntity = utils.getRelatedEntityByFK(
      ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
      specimenRecord[entitySubmitterIdField] as string,
      mergedDonor,
    ) as DeepReadonly<PrimaryDiagnosis | undefined>;
    if (
      // already checking primary diagnosis existence in checkRelatedEntityExists function
      primaryDiagnosisEntity &&
      isEmpty(specimenRecord[SpecimenFieldsEnum.pathological_tumour_staging_system]) &&
      isEmpty(
        primaryDiagnosisEntity.clinicalInfo[
          PrimaryDiagnosisFieldsEnum.clinical_tumour_staging_system
        ],
      )
    ) {
      errors.push(
        utils.buildSubmissionError(
          specimenRecord,
          DataValidationErrors.TNM_STAGING_FIELDS_MISSING,
          SpecimenFieldsEnum.pathological_tumour_staging_system,
          { submitter_specimen_id: specimenRecord[SpecimenFieldsEnum.submitter_specimen_id] },
        ),
      );
    }
  } else if (specimen.tumourNormalDesignation === 'Normal') {
    const forbiddenFieldsForNormal = [...requiredFieldsForTumour, ...optionalFieldsForTumour];
    const existingForbiddenFields = forbiddenFieldsForNormal.filter(field =>
      notEmpty(specimenRecord[field]),
    );
    existingForbiddenFields.forEach(field => {
      errors.push(
        utils.buildSubmissionError(
          specimenRecord,
          DataValidationErrors.FORBIDDEN_PROVIDED_VARIABLE_REQUIREMENT,
          SpecimenFieldsEnum[field],
          errorInfo,
        ),
      );
    });
  }
};
