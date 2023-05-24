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
import _ from 'lodash';
import * as utils from './utils';
import {
  SubmissionValidationError,
  SubmittedClinicalRecord,
  DataValidationErrors,
  SubmissionValidationOutput,
  ClinicalSubmissionRecordsByDonorIdMap,
} from '../submission-entities';
import {
  ClinicalEntitySchemaNames,
  ClinicalTherapyType,
  RadiationFieldsEnum,
  TreatmentFieldsEnum,
} from '../../common-model/entities';
import { getSingleClinicalObjectFromDonor } from '../../common-model/functions';
import { donorDao } from '../../clinical/donor-repo';
import { ClinicalInfo, Donor, Treatment } from '../../clinical/clinical-entities';
import { ClinicalQuery } from '../../clinical/clinical-api';
import { isValueEqual } from '../../utils';

export const validate = async (
  therapyRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
  submittedRecords: DeepReadonly<ClinicalSubmissionRecordsByDonorIdMap>,
): Promise<SubmissionValidationOutput> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  if (!therapyRecord || !mergedDonor || !existentDonor) {
    throw new Error("Can't call this function without a registerd donor & therapy record");
  }

  let errors: SubmissionValidationError[] = [];
  const treatment = getTreatment(therapyRecord, mergedDonor, errors);
  if (!treatment) return { errors };
  // TODO: Refactor use of push
  checkTreatmentHasCorrectTypeForTherapy(therapyRecord, treatment, errors);

  const crossFileErrors = await crossFileValidator(
    mergedDonor,
    treatment,
    therapyRecord,
    submittedRecords,
  );

  errors = [...errors, ...crossFileErrors];
  return { errors };
};

const crossFileValidator = async (
  donor: Donor,
  treatment: DeepReadonly<Treatment>,
  therapyRecord: DeepReadonly<SubmittedClinicalRecord>,
  // submitted records needed to validate current submission
  submittedRecords: DeepReadonly<ClinicalSubmissionRecordsByDonorIdMap>,
) => {
  const isRadiationRecord = Object.values(RadiationFieldsEnum).some(field =>
    Object.keys(therapyRecord).includes(field),
  );

  const radiationErrors: SubmissionValidationError[] = isRadiationRecord
    ? await validateRadiationRecords(donor, treatment, therapyRecord, submittedRecords)
    : [];

  const crossFileErrors = [...radiationErrors];

  return crossFileErrors;
};

const validateRadiationRecords = async (
  donor: Donor,
  treatment: DeepReadonly<Treatment>,
  therapyRecord: DeepReadonly<SubmittedClinicalRecord>,
  submittedRecords: DeepReadonly<ClinicalSubmissionRecordsByDonorIdMap>,
) => {
  const { programId, treatments: currentDonorTreatments } = donor;

  const {
    clinicalInfo: {
      submitter_donor_id: relatedTreatmentDonorId,
      submitter_treatment_id,
      treatment_type,
    },
  } = treatment;

  const {
    submitter_donor_id: submittedTherapyDonorId,
    radiation_boost,
    reference_radiation_treatment_id,
  } = therapyRecord;

  let submittedTreatments: DeepReadonly<ClinicalInfo>[] = [];

  for (const donorId in submittedRecords) {
    const submittedTreatmentRecords = [...submittedRecords[donorId].treatment] as ClinicalInfo[];
    if (submittedTreatmentRecords && submittedTreatmentRecords.length)
      submittedTreatments = [...submittedTreatments, ...submittedTreatmentRecords];
  }

  const query: ClinicalQuery = {
    programShortName: programId,
    entityTypes: [ClinicalEntitySchemaNames.TREATMENT, ClinicalEntitySchemaNames.RADIATION],
    page: 0,
    sort: 'donorId',
    donorIds: [],
    submitterDonorIds: [],
  };

  const { donors } = await donorDao.findByPaginatedProgramId(programId, query);

  const storedTreatments = donors.map(donor => donor.treatments).flat();

  let errors: SubmissionValidationError[] = [];

  if (typeof radiation_boost === 'string' && radiation_boost.toLowerCase() === 'yes') {
    // Reference Radiation ID Matches a Submitted/Previous Submitter Treatment ID
    const submittedTreatmentIdMatch = submitter_treatment_id === reference_radiation_treatment_id;

    const submissionTreatmentIdMatch = submittedTreatments.find(
      treatmentRecord =>
        treatmentRecord.submitter_treatment_id === reference_radiation_treatment_id,
    );

    const storedTreatmentIdMatch = storedTreatments.find(treatmentRecord => {
      const clinicalInfo = treatmentRecord?.clinicalInfo;
      return clinicalInfo?.submitter_treatment_id === reference_radiation_treatment_id;
    });

    const treatmentIdMatch =
      submittedTreatmentIdMatch || submissionTreatmentIdMatch || storedTreatmentIdMatch;

    if (!treatmentIdMatch) {
      errors = [
        ...errors,
        utils.buildSubmissionError(
          therapyRecord,
          DataValidationErrors.INVALID_REFERENCE_RADIATION_DONOR_ID,
          TreatmentFieldsEnum.submitter_treatment_id,
          {
            [TreatmentFieldsEnum.treatment_type]: treatment_type,
            reference_radiation_treatment_id,
            therapyType: ClinicalEntitySchemaNames.RADIATION,
          },
        ),
      ];
    }

    // Therapy + Treatment are associated with Radiation
    const currentTreatmentIsRadiation = treatment_type && treatment_type === 'radiation';

    const submittedTreatmentIsRadiation =
      submissionTreatmentIdMatch && submissionTreatmentIdMatch.treatment_type === 'radiation';

    const storedTreatmentIsRadiation =
      submissionTreatmentIdMatch && submissionTreatmentIdMatch.treatment_type === 'radiation';

    const isRadiation =
      currentTreatmentIsRadiation || submittedTreatmentIsRadiation || storedTreatmentIsRadiation;

    if (!isRadiation) {
      errors = [
        ...errors,
        utils.buildSubmissionError(
          therapyRecord,
          DataValidationErrors.RADIATION_THERAPY_TREATMENT_CONFLICT,
          TreatmentFieldsEnum.submitter_treatment_id,
          {
            [TreatmentFieldsEnum.treatment_type]: treatment_type,
            therapyType: ClinicalEntitySchemaNames.RADIATION,
          },
        ),
      ];
    }

    // const previousTreatmentDonorId = previousDonorMatch?.clinicalInfo?.submitter_donor_id;

    //   if (
    //     (treatmentMatch && treatmentDonorId !== therapyDonorId) ||
    //     (previousDonorMatch && previousTreatmentDonorId !== therapyDonorId)
    //   ) {
    //     errors = [
    //       ...errors,
    //       utils.buildSubmissionError(
    //         therapyRecord,
    //         DataValidationErrors.REFERENCE_RADIATION_ID_CONFLICT,
    //         TreatmentFieldsEnum.submitter_donor_id,
    //         {
    //           reference_radiation_treatment_id,
    //           [TreatmentFieldsEnum.submitter_donor_id]: therapyDonorId,
    //           previousTreatmentDonorId,
    //           therapyType: ClinicalEntitySchemaNames.RADIATION,
    //         },
    //       ),
    //     ];
    //   }
  }

  return errors;
};

export function checkTreatmentHasCorrectTypeForTherapy(
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

export function getTreatment(
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
