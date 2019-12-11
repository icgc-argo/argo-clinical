import chai from 'chai';
import * as analyzer from '../../../src/lectern-client/change-analyzer';
import {
  SchemasDictionaryDiffs,
  FieldDiff,
  ChangeAnalysis,
} from '../../../src/lectern-client/schema-entities';
import _ from 'lodash';
import { notEmpty } from '../../../src/utils';
chai.should();
const diffResponse: any = require('./schema-diff.json');
const schemaDiff: SchemasDictionaryDiffs = {};
for (const entry of diffResponse) {
  const fieldName = entry[0] as string;
  if (entry[1]) {
    const fieldDiff: FieldDiff = {
      before: entry[1].left,
      after: entry[1].right,
      diff: entry[1].diff,
    };
    schemaDiff[fieldName] = fieldDiff;
  }
}

const expectedResult: ChangeAnalysis = {
  fields: {
    addedFields: [],
    renamedFields: [],
    deletedFields: ['primary_diagnosis.menopause_status'],
  },
  restrictionsChanges: {
    codeList: {
      created: [],
      deleted: [
        {
          field: 'donor.vital_status',
          definition: ['Alive', 'Deceased', 'Not reported', 'Unknown'],
        },
      ],
      updated: [
        {
          field: 'donor.cause_of_death',
          definition: {
            added: ['N/A'],
            deleted: ['Died of cancer', 'Unknown'],
          },
        },
      ],
    },
    regex: {
      updated: [
        {
          field: 'donor.submitter_donor_id',
          definition: '[A-Za-z0-9\\-\\._]{3,64}',
        },
        {
          field: 'primary_diagnosis.cancer_type_code',
          definition: '[A-Z]{1}[0-9]{2}.[0-9]{0,3}[A-Z]{2,3}$',
        },
      ],
      created: [
        {
          field: 'donor.vital_status',
          definition: '[A-Z]{3,100}',
        },
      ],
      deleted: [],
    },
    required: {
      updated: [],
      created: [],
      deleted: [],
    },
    script: {
      updated: [],
      created: [
        {
          field: 'donor.survival_time',
          definition: ' $field / 2 == 0 ',
        },
      ],
      deleted: [],
    },
    range: {
      updated: [],
      created: [
        {
          field: 'donor.survival_time',
          definition: {
            min: 0,
            max: 200000,
          },
        },
      ],
      deleted: [],
    },
  },
};

describe('change-analyzer', () => {
  it('categorize changes correctly', () => {
    const result = analyzer.analyzeChanges(schemaDiff);
    result.should.deep.eq(expectedResult);
  });
});
