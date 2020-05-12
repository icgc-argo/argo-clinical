import { Donor } from '../clinical-entities';
import { ClinicalEntitySchemaNames } from '../../common-model/entities';
import { getClinicalEntitiesFromDonorBySchemaName } from '../../common-model/functions';
import _, { isEmpty } from 'lodash';
import { notEmpty } from '../../utils';

function extractDataFromDonors(donors: Donor[], schemasWithFields: any) {
  function getSampleRegistrationDataFromDonor(d: Donor) {
    const baseRegistrationRecord = {
      program_id: d.programId,
      submitter_donor_id: d.submitterId,
      gender: d.gender,
    };

    return d.specimens
      .map(sp =>
        sp.samples.map(sm => ({
          ...baseRegistrationRecord,
          submitter_specimen_id: sp.submitterId,
          specimen_tissue_source: sp.specimenTissueSource,
          tumour_normal_designation: sp.tumourNormalDesignation,
          specimen_type: sp.specimenType,
          submitter_sample_id: sm.submitterId,
          sample_type: sm.sampleType,
        })),
      )
      .flat();
  }

  const recordsMap: any = {};
  donors.forEach(d => {
    Object.values(ClinicalEntitySchemaNames).forEach(entity => {
      let clincialInfoRecords;
      if (entity === ClinicalEntitySchemaNames.REGISTRATION) {
        clincialInfoRecords = getSampleRegistrationDataFromDonor(d);
      } else {
        clincialInfoRecords = getClinicalEntitiesFromDonorBySchemaName(d, entity);
      }
      recordsMap[entity] = _.concat(recordsMap[entity] || [], clincialInfoRecords);
    });
  });

  const data = Object.entries(recordsMap)
    .map(([entityName, records]) => {
      if (isEmpty(records)) return undefined;

      const relevantSchemaWithFields = schemasWithFields.find((s: any) => s.name === entityName);
      if (!relevantSchemaWithFields) {
        throw new Error(`Can't find schema ${entityName}, something is wrong here!`);
      }

      return {
        entityName,
        records,
        entityFields: relevantSchemaWithFields.fields,
      };
    })
    .filter(notEmpty);

  return data;
}

export enum WorkerTasks {
  ExtractDataFromDonors,
}

export const WorkerTasksMap: Record<WorkerTasks, Function> = {
  [WorkerTasks.ExtractDataFromDonors]: extractDataFromDonors,
};
