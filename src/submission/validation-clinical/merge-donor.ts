// a lot of code here overlaps with merge-submissions...
// leaving for now because there may be a bug with merge-submissions

import { DeepReadonly } from 'deep-freeze';
import {
  SubmittedClinicalRecordsMap,
  FieldsEnum,
  TreatmentFieldsEnum,
  ClinicalEntityType,
} from '../submission-entities';
import { Donor, Treatment } from '../../../src/clinical/clinical-entities';
import _ from 'lodash';

export function mergeRecordsIntoDonor(
  submittedRecords: DeepReadonly<SubmittedClinicalRecordsMap>,
  exsistentDonor: DeepReadonly<Donor>,
) {
  const submittedClinicalTypes: Set<String> = new Set(Object.keys(submittedRecords));
  const mergedDonor: any = _.cloneDeep(exsistentDonor);

  if (submittedClinicalTypes.has(ClinicalEntityType.DONOR)) {
    updateDonorInfo(mergedDonor, submittedRecords[ClinicalEntityType.DONOR][0]);
  }
  if (submittedClinicalTypes.has(ClinicalEntityType.PRIMARY_DIAGNOSIS)) {
    updatePrimaryDiagnosis(mergedDonor, submittedRecords[ClinicalEntityType.PRIMARY_DIAGNOSIS][0]);
  }
  if (submittedClinicalTypes.has(ClinicalEntityType.SPECIMEN)) {
    submittedRecords[ClinicalEntityType.SPECIMEN].forEach(r => updateSpecimenInfo(mergedDonor, r));
  }
  if (submittedClinicalTypes.has(ClinicalEntityType.TREATMENT)) {
    submittedRecords[ClinicalEntityType.TREATMENT].forEach(r =>
      addOrUpdateTreatementInfo(mergedDonor, r),
    );
  }
  if (submittedClinicalTypes.has(ClinicalEntityType.CHEMOTHERAPY)) {
    submittedRecords[ClinicalEntityType.CHEMOTHERAPY].forEach(r =>
      addTherapyToTretament(mergedDonor, r, ClinicalEntityType.CHEMOTHERAPY),
    );
  }
  return mergedDonor;
}

const updateDonorInfo = (donor: Donor, record: any) => {
  donor.clinicalInfo = { ...donor.clinicalInfo, ...record };
  return donor.clinicalInfo;
};
const updatePrimaryDiagnosis = (donor: Donor, record: any) => {
  donor.primaryDiagnosis = { ...donor.primaryDiagnosis, ...record };
  return donor.primaryDiagnosis;
};
const updateSpecimenInfo = (donor: Donor, record: any) => {
  const specimen = findSpecimen(donor, record[FieldsEnum.submitter_specimen_id]);
  if (!specimen) return;
  specimen.clinicalInfo = { ...specimen.clinicalInfo, ...record };
  return specimen;
};
const addOrUpdateTreatementInfo = (donor: Donor, record: any): Treatment => {
  const submitterTreatementId = record[TreatmentFieldsEnum.submitter_treatment_id];
  const treatment = findTreatment(donor, submitterTreatementId);
  if (treatment) {
    treatment.clinicalInfo = record;
    return treatment;
  }
  // no treatment, so just add
  donor.treatments = [{ submitterId: submitterTreatementId, clinicalInfo: record, therapies: [] }];
  return donor.treatments[0];
};
const addTherapyToTretament = (donor: any, record: any, therapyType: ClinicalEntityType) => {
  const submitterTreatementId = record[TreatmentFieldsEnum.submitter_treatment_id] as string;
  const treatment = findTreatment(donor, submitterTreatementId);
  if (!treatment) return;
  treatment.therapies = _.concat(treatment.therapies || [], [
    { clinicalInfo: record, therapyType },
  ]);
};

const findSpecimen = (donor: Donor, specimenId: string) => {
  return _.find(donor.specimens, ['submitterId', specimenId]);
};
function findTreatment(donor: Donor, treatmentId: string) {
  if (donor.treatments) {
    return donor.treatments.find(tr => tr.submitterId === treatmentId);
  }
  return undefined;
}

function update(dest: any, src: any) {
  dest = { ...dest, ...src };
}
