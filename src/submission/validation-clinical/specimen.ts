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
  DonorFieldsEnum,
  SpecimenFieldsEnum,
  ClinicalUniqueIdentifier,
  PrimaryDiagnosisFieldsEnum,
} from '../../common-model/entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, PrimaryDiagnosis, Specimen } from '../../clinical/clinical-entities';
import * as utils from './utils';
import { isEmptyString, isEmpty, notEmpty } from '../../utils';
import {
  getEntitySubmitterIdFieldName,
  getSingleClinicalObjectFromDonor,
} from '../../common-model/functions';
import { checkRelatedEntityExists } from './utils';
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
  const donorDataToValidateWith = getDataFromDonorRecordOrDonor(
    specimenRecord,
    mergedDonor,
    errors,
  );

  if (donorDataToValidateWith) {
    checkTimeConflictWithDonor(donorDataToValidateWith, specimenRecord, errors);
  }

  return { errors };
};

function getSpecimenFromDonor(
  existentDonor: DeepReadonly<Donor>,
  specimenRecord: DeepReadonly<SubmittedClinicalRecord>,
  errors: SubmissionValidationError[],
) {
  const specimen = getSingleClinicalObjectFromDonor(
    existentDonor,
    ClinicalEntitySchemaNames.SPECIMEN,
    {
      submitterId: specimenRecord[ClinicalUniqueIdentifier[ClinicalEntitySchemaNames.SPECIMEN]],
    },
  ) as DeepReadonly<Specimen>;

  if (!specimen) {
    errors.push(
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.ID_NOT_REGISTERED,
        SpecimenFieldsEnum.submitter_specimen_id,
      ),
    );
    return undefined;
  }

  return specimen;
}

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

const getDataFromDonorRecordOrDonor = (
  specimenRecord: DeepReadonly<SubmittedClinicalRecord>,
  donor: DeepReadonly<Donor>,
  errors: SubmissionValidationError[],
) => {
  let missingDonorFields: string[] = [];
  let donorVitalStatus: string = '';
  let donorSurvivalTime: number = NaN;
  const donorDataSource = donor.clinicalInfo || {};

  if (_.isEmpty(donorDataSource)) {
    missingDonorFields = [DonorFieldsEnum.vital_status, DonorFieldsEnum.survival_time];
  } else {
    donorVitalStatus = (donorDataSource[DonorFieldsEnum.vital_status] as string) || '';
    donorSurvivalTime = Number(donorDataSource[DonorFieldsEnum.survival_time]) || NaN;

    if (isEmptyString(donorVitalStatus)) {
      missingDonorFields.push(DonorFieldsEnum.vital_status);
    }
    if (donorVitalStatus.toString().toLowerCase() === 'deceased' && isNaN(donorSurvivalTime)) {
      missingDonorFields.push(DonorFieldsEnum.survival_time);
    }
  }

  if (missingDonorFields.length > 0) {
    errors.push(
      utils.buildSubmissionError(
        specimenRecord,
        DataValidationErrors.NOT_ENOUGH_INFO_TO_VALIDATE,
        SpecimenFieldsEnum.specimen_acquisition_interval,
        {
          missingField: missingDonorFields.map(s => ClinicalEntitySchemaNames.DONOR + '.' + s),
        },
      ),
    );
    return undefined;
  }

  return { donorVitalStatus, donorSurvivalTime };
};

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
    ) as DeepReadonly<PrimaryDiagnosis>;

    if (
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
