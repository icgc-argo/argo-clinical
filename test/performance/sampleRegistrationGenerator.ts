import { SchemasDictionary, FieldDefinition } from '../../src/lectern-client/schema-entities';
import _ from 'lodash';
const sampleDictionary = require('../../sampleFiles/sample-schema.json');

const schema: SchemasDictionary = sampleDictionary.dictionaries[0];
const choice = (array: Array<any> | undefined) => {
  if (array === undefined) {
    console.log('ERROR in choice: Array is undefined.');
    return;
  }
  const choice = array ? Math.floor(Math.random() * array.length) : -1;
  return array[choice];
};

const randomIntFromRange = (x: number | [number, number]) => {
  return typeof x === 'number' ? x : Math.floor(Math.random() * (x[1] - x[0] + 1) + x[0]);
};

const getCodelist = (file: number, elementName: string) => {
  const codeList = schema.schemas[file].fields.find(element => element.name === elementName)
    ?.restrictions?.codeList;
  return codeList !== undefined ? codeList : [];
};

interface Counts {
  donorCount: number | [number, number];
  specimenCount: number | [number, number];
  sampleCount: number | [number, number];
}

interface SampleRegistrationConstants {
  gender: string;
  specimen_tissue_source: string;
  tumour_normal_designation: string;
  specimen_type: string;
}

const genericChooser = (
  chosenFields: readonly FieldDefinition[],
  shortName: string,
  counts: number[],
) => {
  return chosenFields.map(element => {
    if (element.meta && element.meta.primaryId) {
      // Dealing with PrimaryIds
      switch (element.name) {
        case 'program_id':
          return shortName;
        case 'submitter_donor_id':
          return `subDonor-${counts[0]}`;
        case 'submitter_specimen_id':
          return `subSpecimen-${counts[0]}.${counts[1]}`;
        case 'submitter_sample_id':
          return `subSample-${counts[0]}.${counts[1]}.${counts[2]}`;
        default:
          return;
      }
    } else if (element.restrictions && element.restrictions.script) {
      // Script Handling outside scope
      return `TEMP`;
    } else if (element.valueType === 'integer') {
      // Random integer
      return randomIntFromRange([1, 100]);
    } else if (element.restrictions && element.restrictions.codeList) {
      // Code Lists Choice
      return choice(element.restrictions.codeList);
    } else {
      // Error Handing outside scope
      return `ERROR`;
    }
  });
};

const randomDonor = (shortName: string, counts: number[]) => {};

// Generates lines for sample registration
const randomSample = (
  shortName: string,
  constants: SampleRegistrationConstants,
  counts: number[],
) => {
  const fields = schema.schemas[0].fields;
  const choicesNoScripts = genericChooser(fields, shortName, counts);
  const choicesMap = Object.assign(
    _.zipObject(
      fields.map(element => element.name),
      choicesNoScripts,
    ),
    constants,
  );
  return Object.values(choicesMap)
    .join('\t')
    .concat('\n');

  // const chosenFields = fields.filter(
  //   element => (element.restrictions && element.restrictions.required) || Math.random() > 0.5,
  // ); // Choosing not required fields randomly
};

// Generates tsv files
const generateFiles = (shortName: string, maxCounts: Counts) => {
  const fs = require('fs');
  let sampleConstants: SampleRegistrationConstants = {
    gender: 'Male',
    specimen_tissue_source: 'Plasma',
    tumour_normal_designation: 'Tumour',
    specimen_type: 'Primary Tumour',
  };
  fs.appendFile(
    `./test/performance/sample_registration-${shortName}.tsv`,
    schema.schemas[0].fields
      .map(element => element.name)
      .join('\t')
      .concat('\n'),
    function(err: any) {
      if (err) throw err;
    },
  );
  const donorMax = randomIntFromRange(maxCounts.donorCount);
  for (let i = 0; i < donorMax; i++) {
    // fs.append to donor
    sampleConstants.gender = choice(getCodelist(0, 'gender'));
    let specimenMax = randomIntFromRange(maxCounts.specimenCount);
    for (let j = 0; j < specimenMax; j++) {
      // fs.append to specimen
      sampleConstants.specimen_tissue_source = choice(getCodelist(0, 'specimen_tissue_source'));
      sampleConstants.tumour_normal_designation = choice(
        getCodelist(0, 'tumour_normal_designation'),
      );
      sampleConstants.specimen_type =
        sampleConstants.tumour_normal_designation === 'Normal'
          ? choice(
              getCodelist(0, 'specimen_type').filter(
                element => typeof element === 'string' && !element.toLowerCase().includes('tumour'),
              ),
            )
          : choice(
              getCodelist(0, 'specimen_type').filter(
                element =>
                  typeof element === 'string' &&
                  (element.toLowerCase().includes('tumour') || element.startsWith('Normal')),
              ),
            );
      let sampleMax = randomIntFromRange(maxCounts.sampleCount);
      for (let k = 0; k < sampleMax; k++) {
        fs.appendFile(
          `./test/performance/sample_registration-${shortName}.tsv`,
          randomSample(shortName, sampleConstants, [i, j, k]),
          function(err: any) {
            if (err) throw err;
          },
        );
      }
    }
  }
};

generateFiles('ZPRI-CA', { donorCount: 1, specimenCount: 3, sampleCount: [1, 6] });
