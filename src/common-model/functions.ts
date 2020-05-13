import { DeepReadonly } from 'deep-freeze';
import { Donor, ClinicalInfo } from '../clinical/clinical-entities';
import {
  ClinicalEntitySchemaNames,
  ClinicalUniqueIdentifier,
  ClinicalTherapySchemaNames,
  ClinicalFields,
} from './entities';
import _ from 'lodash';
import { notEmpty } from '../utils';

export function getSingleClinicalObjectFromDonor(
  donor: DeepReadonly<Donor>,
  clinicalEntitySchemaName: ClinicalEntitySchemaNames,
  constraints: object, // similar to mongo filters, e.g. {submitted_donor_id: 'DR_01'}
) {
  const entities = getClinicalObjectsFromDonor(donor, clinicalEntitySchemaName);
  return _.find(entities, constraints);
}

export function getClinicalObjectsFromDonor(
  donor: DeepReadonly<Donor>,
  clinicalEntitySchemaName: ClinicalEntitySchemaNames,
) {
  if (clinicalEntitySchemaName == ClinicalEntitySchemaNames.DONOR) {
    return [donor];
  }

  if (clinicalEntitySchemaName == ClinicalEntitySchemaNames.SPECIMEN) {
    return donor.specimens;
  }

  if (clinicalEntitySchemaName == ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS) {
    if (donor.primaryDiagnoses) {
      return donor.primaryDiagnoses;
    }
  }

  if (clinicalEntitySchemaName === ClinicalEntitySchemaNames.TREATMENT) {
    if (donor.treatments) {
      return donor.treatments;
    }
  }

  if (clinicalEntitySchemaName === ClinicalEntitySchemaNames.FOLLOW_UP) {
    if (donor.followUps) {
      return donor.followUps;
    }
  }

  if (ClinicalTherapySchemaNames.find(tsn => tsn === clinicalEntitySchemaName)) {
    if (donor.treatments) {
      return donor.treatments
        .map(tr => tr.therapies.filter(th => th.therapyType === clinicalEntitySchemaName))
        .flat()
        .filter(notEmpty);
    }
  }
  return [];
}

export function getClinicalEntitiesFromDonorBySchemaName(
  donor: DeepReadonly<Donor>,
  clinicalEntitySchemaName: ClinicalEntitySchemaNames,
): ClinicalInfo[] {
  const result = getClinicalObjectsFromDonor(donor, clinicalEntitySchemaName) as any[];

  const clinicalRecords = result
    .map((e: any) => {
      if (e.clinicalInfo) {
        return e.clinicalInfo as ClinicalInfo;
      }
    })
    .filter(notEmpty);
  return clinicalRecords;
}

export function getSingleClinicalEntityFromDonorBySchemanName(
  donor: DeepReadonly<Donor>,
  clinicalEntityType: ClinicalEntitySchemaNames,
  clinicalInfoRef: ClinicalInfo, // this function will use the values of the clinicalInfoRef that are needed to uniquely find a clinical info
): ClinicalInfo | undefined {
  if (clinicalEntityType === ClinicalEntitySchemaNames.REGISTRATION) {
    throw new Error('Sample_registration has no clincal info to return');
  }
  const uniqueIdNames: string[] = _.concat([], ClinicalUniqueIdentifier[clinicalEntityType]);
  if (_.isEmpty(uniqueIdNames)) {
    throw new Error("illegale state, couldn't find entity id field name");
  }
  const constraints: ClinicalInfo = {};
  uniqueIdNames.forEach(idN => (constraints[idN] = clinicalInfoRef[idN]));

  const clinicalInfos = getClinicalEntitiesFromDonorBySchemaName(donor, clinicalEntityType);
  return _(clinicalInfos).find(constraints);
}

export function getEntitySubmitterIdFieldName(entityName: ClinicalEntitySchemaNames) {
  return `submitter_${entityName}_id` as string;
}
