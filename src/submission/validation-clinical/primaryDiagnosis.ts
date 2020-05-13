import { SubmissionValidationError, SubmittedClinicalRecord } from '../submission-entities';
import { ClinicalEntitySchemaNames, PrimaryDiagnosisFieldsEnum } from '../../common-model/entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import _ from 'lodash';
import { getClinicalEntitiesFromDonorBySchemaName } from '../../common-model/functions';
import { checkClinicalEntityDoesntBelongToOtherDonor } from './utils';

export const validate = async (
  primaryDiagnosisRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
): Promise<SubmissionValidationError[]> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  if (!primaryDiagnosisRecord || !existentDonor) {
    throw new Error("Can't call this function without followup records");
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

  return errors;
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
