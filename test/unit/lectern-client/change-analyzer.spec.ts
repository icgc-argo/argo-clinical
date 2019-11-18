import chai from 'chai';
import * as analyzer from '../../../src/lectern-client/change-analyzer';
import {
  SchemasDictionaryDiffs,
  FieldDiff,
  ChangeAnalysis,
} from '../../../src/lectern-client/schema-entities';
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
          addition: [],
          deletion: [],
        },
      ],
      updated: [
        {
          field: 'donor.cause_of_death',
          addition: ['N/A'],
          deletion: ['Died of cancer', 'Unknown'],
        },
      ],
    },
    regex: {
      updated: [
        {
          field: 'donor.submitter_donor_id',
          value: '[A-Za-z0-9\\-\\._]{3,64}',
        },
        {
          field: 'primary_diagnosis.cancer_type_code',
          value: '[A-Z]{1}[0-9]{2}.[0-9]{0,3}[A-Z]{2,3}$',
        },
      ],
      created: [
        {
          field: 'donor.vital_status',
          value: '[A-Z]{3,100}',
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
          value: ' $field / 2 == 0 ',
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
