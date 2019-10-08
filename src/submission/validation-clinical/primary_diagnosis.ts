import {
  FieldsEnum,
  DataValidationErrors,
  SubmittedClinicalRecord,
  SubmissionValidationError,
  ValidatorResult,
  ModificationType,
} from '../submission-entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor } from '../../clinical/clinical-entities';
import { FileType } from '../submission-api';
import * as utils from './utils';
import _ from 'lodash';

export const validate = async (
  newRecords: DeepReadonly<{ [clinicalType: string]: SubmittedClinicalRecord }>,
  existentDonor: DeepReadonly<Donor>,
): Promise<ValidatorResult> => {
  const errors: SubmissionValidationError[] = [];
  const pdRecord = newRecords[FileType.PRIMARY_DIAGNOSES];

  // Preconditions: if any one of these validation failed, can't continue
  if (!utils.checkDonorRegistered(existentDonor, pdRecord)) {
    return utils.buildValidatorResult(ModificationType.ERRORSFOUND, pdRecord.index, [
      utils.buildSubmissionError(
        pdRecord,
        DataValidationErrors.ID_NOT_REGISTERED,
        FieldsEnum.submitter_donor_id,
      ),
    ]);
  }

  // cross entity record validation

  return errors.length > 0
    ? utils.buildValidatorResult(ModificationType.ERRORSFOUND, pdRecord.index, errors)
    : await utils.checkForUpdates(pdRecord, existentDonor.primaryDiagnosis);
};
