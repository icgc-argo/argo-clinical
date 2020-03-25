import { migrationDiffs } from './stub-diffs';
import _ from 'lodash';
import fs from 'fs';
import { schemaV1_accessible, schemaV2, schemaV3 } from './static-schema-data';
const DICTIONARY_NAME = 'ARGO Clinical Submission';

export const buildDynamicStubSchema = () => {
  const convertToDictionaryNotation = (schemaVersion: Object) => {
    return Object.values(schemaVersion).map(schema => {
      const { fields, ...rest } = schema;
      const newFields = Object.values(schema.fields);
      return _.assign(rest, { fields: newFields });
    });
  };

  const legacyDictionaries = [
    {
      schemas: convertToDictionaryNotation(schemaV1_accessible),
      name: DICTIONARY_NAME,
      version: '1.0',
    },

    {
      schemas: schemaV2,
      name: DICTIONARY_NAME,
      version: '2.0',
    },

    {
      schemas: schemaV3,
      name: DICTIONARY_NAME,
      version: '3.0',
    },
  ];

  // Change 8.1.1.1 adding new enum value Adding an enum to the codelist
  const schemaV4 = _.cloneDeep(schemaV1_accessible);
  schemaV4.donor.fields.cause_of_death.restrictions.codeList.push('Died from disease');

  // Change #8.1.1.2 adding non-required field
  const schemaV5 = _.cloneDeep(schemaV1_accessible);
  _.assign(schemaV5.donor.fields, {
    height: {
      description: 'How tall is the donor',
      name: 'height',
      restrictions: {
        required: false,
      },
      valueType: 'string',
    },
  });

  // Change #8.1.1.3 adding new file (dictionary schema)
  const schemaV6 = _.cloneDeep(schemaV1_accessible);
  _.assign(schemaV6, {
    // lectern doesn't recognize diffs unless there are fields involved
    lifestyle_factors: {
      name: 'lifestyle_factors',
      description: 'Extra lifestyle factors',
      fields: { diet: { description: 'the diet they eat', name: 'diet', valueType: 'string' } },
    },
  });

  // Change #8.1.2.1 removing a value from enum
  const schemaV7 = _.cloneDeep(schemaV1_accessible);
  _.remove(
    schemaV7.primary_diagnosis.fields.tumour_staging_system.restrictions.codeList,
    code => code === 'Murphy',
  );

  // Change #8.1.2.2 adding a new required field
  const schemaV8 = _.cloneDeep(schemaV1_accessible);
  _.assign(schemaV8.donor.fields, {
    eye_colour: {
      description: 'colour of their eye',
      name: 'eye_colour',
      restrictions: {
        required: true,
      },
      valueType: 'string',
    },
  });

  // Change #8.1.2.3 removing field
  const schemaV9 = _.cloneDeep(schemaV1_accessible);
  delete schemaV9.donor.fields.cause_of_death;

  // Change #8.1.2.4 adding/changing script on existing fields, regular expression or similar validation rules
  const schemaV10 = _.cloneDeep(schemaV1_accessible);
  schemaV10.primary_diagnosis.fields.cancer_type_code.restrictions.regex = '^aRegexToFail$';
  _.assign(schemaV10.primary_diagnosis.fields.age_at_diagnosis.restrictions, {
    script: [
      "(function validate() {\n    return { valid: false, message: 'not a valid age!' };\n  })()",
    ],
  });

  // Change #8.1.3.1 changing field's value type
  const schemaV11 = _.cloneDeep(schemaV1_accessible);
  schemaV11.donor.fields.survival_time.valueType = 'string';

  // Change #8.1.3.2 renaming field
  const schemaV12 = _.cloneDeep(schemaV1_accessible);
  schemaV12.donor.fields.program_id.name = 'program_identification_code';

  // Change #8.1.3.3 removing file
  const schemaV13 = _.cloneDeep(schemaV1_accessible);
  delete schemaV13.hormone_therapy;

  const newSchemas = {
    '4.0': schemaV4,
    '5.0': schemaV5,
    '6.0': schemaV6,
    '7.0': schemaV7,
    '8.0': schemaV8,
    '9.0': schemaV9,
    '10.0': schemaV10,
    '11.0': schemaV11,
    '12.0': schemaV12,
    '13.0': schemaV13,
  };
  const newDictionaries = legacyDictionaries.concat(
    Object.entries(newSchemas).map(([versionNum, schemaObj]) => {
      return {
        schemas: convertToDictionaryNotation(schemaObj),
        name: DICTIONARY_NAME,
        version: versionNum,
      };
    }),
  );

  const stub_schema = {
    diffs: migrationDiffs.map(diffObj => {
      return { name: DICTIONARY_NAME, ...diffObj };
    }),
    dictionaries: newDictionaries,
  };

  fs.writeFileSync(
    `${__dirname}/../migration-stub-schema.json`,
    JSON.stringify(stub_schema, undefined, 2),
  );
};
