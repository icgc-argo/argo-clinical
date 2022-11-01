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

import { DeepReadonly } from 'deep-freeze';
import { Donor, ClinicalInfo } from '../clinical/clinical-entities';
import {
  ClinicalEntitySchemaNames,
  ClinicalUniqueIdentifier,
  ClinicalTherapySchemaNames,
  EntityAlias,
} from './entities';
import _ from 'lodash';
import { notEmpty, convertToArray } from '../utils';

export function getSingleClinicalObjectFromDonor(
  donor: DeepReadonly<Donor>,
  clinicalEntitySchemaName: ClinicalEntitySchemaNames,
  constraints: object, // similar to mongo filters, e.g. {submitted_donor_id: 'DR_01'}
) {
  const entities = getClinicalObjectsFromDonor(donor, clinicalEntitySchemaName);
  return _.find(entities, constraints);
}

export function findClinicalObjects(
  donor: DeepReadonly<Donor>,
  clinicalEntitySchemaName: ClinicalEntitySchemaNames,
  constraints: object,
) {
  const entities = getClinicalObjectsFromDonor(donor, clinicalEntitySchemaName);
  return _.filter(entities, constraints);
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

  if (
    clinicalEntitySchemaName == ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS &&
    donor.primaryDiagnoses
  ) {
    return donor.primaryDiagnoses;
  }

  if (clinicalEntitySchemaName == ClinicalEntitySchemaNames.FAMILY_HISTORY && donor.familyHistory) {
    return donor.familyHistory;
  }

  if (
    (clinicalEntitySchemaName === ClinicalEntitySchemaNames.TREATMENT ||
      clinicalEntitySchemaName === ClinicalEntitySchemaNames.SURGERY) &&
    donor.treatments
  ) {
    return donor.treatments;
  }

  if (clinicalEntitySchemaName === ClinicalEntitySchemaNames.FOLLOW_UP && donor.followUps) {
    return donor.followUps;
  }

  if (clinicalEntitySchemaName === ClinicalEntitySchemaNames.EXPOSURE && donor.exposure) {
    return donor.exposure;
  }

  if (clinicalEntitySchemaName === ClinicalEntitySchemaNames.BIOMARKER && donor.biomarker) {
    return donor.biomarker;
  }

  if (clinicalEntitySchemaName === ClinicalEntitySchemaNames.COMORBIDITY && donor.comorbidity) {
    return donor.comorbidity;
  }

  if (
    ClinicalTherapySchemaNames.find(tsn => tsn === clinicalEntitySchemaName) &&
    donor.treatments
  ) {
    return donor.treatments
      .map(tr => tr.therapies.filter(th => th.therapyType === clinicalEntitySchemaName))
      .flat()
      .filter(notEmpty);
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

export function getClinicalEntitySubmittedData(
  donor: DeepReadonly<Donor>,
  clinicalEntitySchemaName: ClinicalEntitySchemaNames,
): ClinicalInfo[] {
  const result = getClinicalObjectsFromDonor(donor, clinicalEntitySchemaName) as any[];

  let clinicalRecords = [];

  switch (clinicalEntitySchemaName) {
    case ClinicalEntitySchemaNames.DONOR: {
      clinicalRecords = result.map((entity: any) => ({
        donor_id: donor.donorId,
        program_id: donor.programId,
        ...entity.clinicalInfo,
      }));
      break;
    }
    case ClinicalEntitySchemaNames.TREATMENT: {
      clinicalRecords = result.map((treatment: any) => {
        const clinicalInfo = treatment.clinicalInfo || {};
        const therapy_type =
          treatment.therapies.length === 1
            ? { therapy_type: treatment.therapies[0].therapyType }
            : {};
        const therapy_info =
          treatment.therapies.length === 1 && treatment.therapies[0].clinicalInfo;
        return {
          donor_id: donor.donorId,
          program_id: donor.programId,
          treatment_id: treatment.treatmentId,
          ...clinicalInfo,
          ...therapy_type,
          ...therapy_info,
        };
      });
      break;
    }
    case ClinicalEntitySchemaNames.SURGERY: {
      clinicalRecords = result
        .filter(therapy =>
          therapy.clinicalInfo.treatment_type.find((type: string) => type.match(/surgery/i)),
        )
        .map((surgery: any) => {
          const clinicalInfo = surgery.clinicalInfo || {};
          return {
            donor_id: donor.donorId,
            program_id: donor.programId,
            treatment_id: surgery.treatmentId,
            ...clinicalInfo,
          };
        });
      break;
    }
    default: {
      clinicalRecords = result
        .filter(record => notEmpty(record.clinicalInfo))
        .map((entity: any) => ({
          donor_id: donor.donorId,
          program_id: donor.programId,
          submitter_id: donor.submitterId,
          ...entity.clinicalInfo,
        }));
    }
  }

  return clinicalRecords;
}

export const getRequiredDonorFieldsForEntityTypes = (
  entityTypes: EntityAlias[],
): Array<EntityAlias | ClinicalEntitySchemaNames | 'completionStats'> => {
  if (
    // Donor Completion Stats require Sample Registration data
    // Sample Registration requires Specimen data
    (entityTypes.includes('donor') && !entityTypes.includes('sampleRegistration')) ||
    (entityTypes.includes('sampleRegistration') && !entityTypes.includes('specimens'))
  ) {
    return [
      'completionStats',
      'sampleRegistration',
      ClinicalEntitySchemaNames.REGISTRATION,
      'specimens',
    ];
  } else if (
    // Clinical Therapies require Treatments
    // hormoneTherapy + treatment do not match schema names
    entityTypes.includes('hormoneTherapy') ||
    entityTypes.includes('treatment') ||
    ClinicalTherapySchemaNames.some(entity => entityTypes.includes(entity))
  ) {
    return ['treatments'];
  } else return [];
};

export function getSingleClinicalEntityFromDonorBySchemanName(
  donor: DeepReadonly<Donor>,
  clinicalEntityType: ClinicalEntitySchemaNames,
  clinicalInfoRef: ClinicalInfo, // this function will use the values of the clinicalInfoRef that are needed to uniquely find a clinical info
): ClinicalInfo | undefined {
  if (clinicalEntityType === ClinicalEntitySchemaNames.REGISTRATION) {
    throw new Error('Sample_registration has no clincal info to return');
  }
  const uniqueIdNames: string[] = convertToArray(ClinicalUniqueIdentifier[clinicalEntityType]);
  if (_.isEmpty(uniqueIdNames)) {
    throw new Error("Illegal state, couldn't find entity id field name");
  }
  const constraints: ClinicalInfo = {};
  uniqueIdNames.forEach(idN => (constraints[idN] = clinicalInfoRef[idN]));

  const clinicalInfos = getClinicalEntitiesFromDonorBySchemaName(donor, clinicalEntityType);
  return _(clinicalInfos).find(constraints);
}

export function getEntitySubmitterIdFieldName(entityName: ClinicalEntitySchemaNames) {
  return `submitter_${entityName}_id` as string;
}
