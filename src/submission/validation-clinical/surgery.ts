import { Donor, Therapy, Treatment } from '../../clinical/clinical-entities';
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
      mergedDonor,
      ClinicalEntitySchemaNames.SURGERY,
      { clinicalInfo: { [SurgeryFieldsEnum.submitter_specimen_id]: specimenId as string } },
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
        mergedDonor,
        ClinicalEntitySchemaNames.SURGERY,
        {
          ClinicalInfo: {
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
              DataValidationErrors.DUPLICATE_SUBMITTER_SPECIMEN_ID_IN_SURGERY,
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
      mergedDonor,
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
            DataValidationErrors.DUPLICATE_SUBMITTER_SPECIMEN_ID_IN_SURGERY,
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
