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

function randomIntFromRange(x: number | [number, number]) {
  return typeof x === 'number' ? x : Math.floor(Math.random() * (x[1] - x[0] + 1) + x[0]);
}

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
      if (element.name === 'program_id') {
        return shortName;
      } else if (element.name === 'submitter_donor_id') {
        return `subDonor-${counts[0]}`;
      } else if (element.name === 'submitter_specimen_id') {
        return `subSpecimen-${counts[0]}.${counts[1]}`;
      } else if (element.name === 'submitter_sample_id') {
        return `subSample-${counts[0]}.${counts[1]}.${counts[2]}`;
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

// Generates lines for sample registration
const randomSample = (
  shortName: string,
  constants: SampleRegistrationConstants,
  counts: number[],
) => {
  const fields = schema.schemas[0].fields;
  const choicesNoScripts = genericChooser(fields, shortName, counts);
  const headers = fields.map(element => element.name);
  const choicesMap = _.zipObject(headers, choicesNoScripts);
  // Script and Constant Handling
  Object.keys(choicesMap).forEach(key => {
    Object.keys(constants).forEach(key => {
      choicesMap[key] = constants[key]; // @Minh
    });
    if (key === 'specimen_type' && choicesMap['tumour_normal_designation'] === 'Normal') {
      choicesMap[key] = choice(
        fields
          .find(element => element.name === 'specimen_type')
          ?.restrictions?.codeList?.filter(
            element => typeof element === 'string' && !element.toLowerCase().includes('tumour'),
          ),
      );
    } else if (key === 'specimen_type' && choicesMap['tumour_normal_designation'] === 'Tumour') {
      choicesMap[key] = choice(
        fields
          .find(element => element.name === 'specimen_type')
          ?.restrictions?.codeList?.filter(
            element =>
              typeof element === 'string' &&
              (element.toLowerCase().includes('tumour') || element.startsWith('Normal')),
          ),
      );
    }
    if (choicesMap[key] === 'ERROR') {
      console.log('ERROR in randomSample');
    }
  });
  return Object.values(choicesMap).join('\t');

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
    sampleConstants.gender = choice(
      schema.schemas[0].fields.find(element => element.name === 'gender')?.restrictions?.codeList,
    );
    let specimenMax = randomIntFromRange(maxCounts.specimenCount);
    for (let j = 0; j < specimenMax; j++) {
      // fs.append to specimen
      let sampleMax = randomIntFromRange(maxCounts.sampleCount);
      for (let k = 0; k < sampleMax; k++) {
        let counts = [i, j, k];
        fs.appendFile(
          `./test/performance/sample_registration-${shortName}.tsv`,
          randomSample(shortName, sampleConstants, counts).concat('\n'),
          function(err: any) {
            if (err) throw err;
          },
        );
      }
    }
  }
};

generateFiles('ZPRI-CA', { donorCount: 3, specimenCount: 2, sampleCount: 2 });
