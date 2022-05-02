import { Donor, Therapy, Treatment } from '../../clinical/clinical-entities';
import {
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
      { ClinicalInfo: { [SurgeryFieldsEnum.submitter_specimen_id]: specimenId as string } },
    ) as DeepReadonly<Therapy>;

    if (existingSurgeryBySpecimenId) {
      // Has sub_sp_id been submitted in surgery before? if yes, then invalid
      errors.push();
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
      } else {
        // no existing surgery, valid, do nothing.
      }
    }
  } else {
  }

  return { errors };
};
