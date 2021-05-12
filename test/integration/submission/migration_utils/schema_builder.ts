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

import { migrationDiffs } from './stub-diffs';
import _ from 'lodash';
import fs from 'fs';
import { entities as dictionaryEntities } from '@overturebio-stack/lectern-client';
import legacyStubSchemas from '../../stub-schema.json';
import { ClinicalEntitySchemaNames } from '../../../../src/common-model/entities';
import * as fieldNames from './fields';

const DICTIONARY_NAME = 'ARGO Clinical Submission';
// all new dynamic schemas will be extended upon from this base version
const dictionaryV1 = legacyStubSchemas.dictionaries[0] as dictionaryEntities.SchemasDictionary;

interface MutableSchemaDefinition {
  name: string;
  description: string;
  fields: Array<dictionaryEntities.FieldDefinition>;
}

const getSchema = (
  dictionary: dictionaryEntities.SchemasDictionary,
  schemaName: string,
): MutableSchemaDefinition => {
  const schema = dictionary.schemas.find(s => s.name == schemaName);
  if (!schema) throw new Error('schema not found');
  return schema as MutableSchemaDefinition;
};

const getField = (
  dictionary: dictionaryEntities.SchemasDictionary,
  schemaName: string,
  fieldName: string,
): dictionaryEntities.FieldDefinition => {
  const field = getSchema(dictionary, schemaName)?.fields?.find(f => f.name == fieldName);
  if (!field) throw new Error(`field ${fieldName} not found`);
  return field;
};

export const buildDynamicStubSchema = () => {
  // Change 8.1.1.1 adding new enum value Adding an enum to the codelist

  const schemaV4 = _.cloneDeep(dictionaryV1);
  schemaV4.version = '4.0';
  getField(
    schemaV4,
    ClinicalEntitySchemaNames.DONOR,
    fieldNames.donor.CAUSE_OF_DEATH,
  ).restrictions?.codeList?.push('Died from disease');

  // Change #8.1.1.2 adding non-required field

  const schemaV5 = _.cloneDeep(dictionaryV1);
  schemaV5.version = '5.0';
  getSchema(schemaV5, ClinicalEntitySchemaNames.DONOR).fields.push({
    description: 'How tall is the donor',
    name: 'height',
    restrictions: {
      required: false,
    },
    valueType: dictionaryEntities.ValueType.STRING,
  });

  // Change #8.1.1.3 adding new file (dictionary schema)

  const schemaV6 = _.cloneDeep(dictionaryV1);
  schemaV6.version = '6.0';

  schemaV6.schemas.push({
    name: 'lifestyle_factors',
    description: 'Extra lifestyle factors',
    fields: [
      {
        description: 'the diet they eat',
        name: 'diet',
        valueType: dictionaryEntities.ValueType.STRING,
      },
    ],
  });

  // Change #8.1.2.1 removing a value from enum

  const schemaV7 = _.cloneDeep(dictionaryV1);
  schemaV7.version = '7.0';

  const s7_presentingSymptomsCodeList =
    getField(
      schemaV7,
      ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
      fieldNames.primaryDiagnosis.PRESENTING_SYMPTOMS,
    ).restrictions?.codeList || [];
  _.remove(s7_presentingSymptomsCodeList, code => code === 'Nausea');

  // Change #8.1.2.2 adding a new required field

  const schemaV8 = _.cloneDeep(dictionaryV1);
  schemaV8.version = '8.0';

  getSchema(schemaV8, ClinicalEntitySchemaNames.DONOR).fields.push({
    description: 'colour of their eye',
    name: 'eye_colour',
    restrictions: {
      required: true,
    },
    valueType: dictionaryEntities.ValueType.STRING,
  });

  // Change #8.1.2.3 removing field
  const schemaV9 = _.cloneDeep(dictionaryV1);
  schemaV9.version = '9.0';

  _.remove(
    getSchema(schemaV9, ClinicalEntitySchemaNames.DONOR).fields,
    field => field.name === fieldNames.donor.CAUSE_OF_DEATH,
  );

  // Change #8.1.2.4 adding/changing script on existing fields, regular expression or similar validation rules

  const schemaV10 = _.cloneDeep(dictionaryV1);
  schemaV10.version = '10.0';

  const s10_cancerTypeCodeRestrictions = getField(
    schemaV10,
    ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
    fieldNames.primaryDiagnosis.CANCER_TYPE_CODE,
  ).restrictions;
  if (s10_cancerTypeCodeRestrictions !== undefined) {
    _.assign(s10_cancerTypeCodeRestrictions, { regex: '^aRegexToFail$' });
  }
  const s10_ageAtDiagnosisRestrictions = getField(
    schemaV10,
    ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
    fieldNames.primaryDiagnosis.AGE_AT_DIAGNOSIS,
  ).restrictions;
  if (s10_ageAtDiagnosisRestrictions !== undefined) {
    _.assign(s10_ageAtDiagnosisRestrictions, {
      script: [
        "(function validate() {\n    return { valid: false, message: 'not a valid age!' };\n  })()",
      ],
    });
  }

  // Change #8.1.3.1 changing field's value type

  const schemaV11 = _.cloneDeep(dictionaryV1);
  schemaV11.version = '11.0';

  getField(schemaV11, ClinicalEntitySchemaNames.DONOR, fieldNames.donor.SURVIVAL_TIME).valueType =
    dictionaryEntities.ValueType.STRING;

  // Change #8.1.3.2 renaming field
  const schemaV12 = _.cloneDeep(dictionaryV1);
  schemaV12.version = '12.0';

  getField(schemaV12, ClinicalEntitySchemaNames.DONOR, fieldNames.donor.PROGRAM_ID).name =
    'program_identification_code';

  // Change #8.1.3.3 removing file

  const schemaV13 = _.cloneDeep(dictionaryV1);
  schemaV13.version = '13.0';

  _.remove(schemaV13.schemas, schema => schema.name === ClinicalEntitySchemaNames.HORMONE_THERAPY);

  const schemaV14 = _.cloneDeep(dictionaryV1);
  schemaV14.version = '14.0';

  getField(
    schemaV14,
    ClinicalEntitySchemaNames.REGISTRATION,
    fieldNames.sampleRegistration.PROGRAM_ID,
  ).valueType = dictionaryEntities.ValueType.INTEGER;

  getField(
    schemaV14,
    ClinicalEntitySchemaNames.REGISTRATION,
    fieldNames.sampleRegistration.SUBMITTER_DONOR_ID,
  ).valueType = dictionaryEntities.ValueType.INTEGER;

  getField(schemaV14, ClinicalEntitySchemaNames.DONOR, fieldNames.donor.PROGRAM_ID).valueType =
    dictionaryEntities.ValueType.INTEGER;

  getField(
    schemaV14,
    ClinicalEntitySchemaNames.DONOR,
    fieldNames.donor.SUBMITTER_DONOR_ID,
  ).valueType = dictionaryEntities.ValueType.INTEGER;

  const schemaV15 = _.cloneDeep(dictionaryV1);
  schemaV15.version = '15.0';

  _.remove(
    getSchema(schemaV15, ClinicalEntitySchemaNames.REGISTRATION).fields,
    field => field.name === fieldNames.sampleRegistration.SPECIMEN_TYPE,
  );

  /** Version 16.0  */
  const schemaV16 = _.cloneDeep(dictionaryV1);
  schemaV16.version = '16.0';

  getField(
    schemaV16,
    ClinicalEntitySchemaNames.TREATMENT,
    fieldNames.treatment.TREATMENT_DURATION,
  ).valueType = dictionaryEntities.ValueType.NUMBER;

  getField(
    schemaV16,
    ClinicalEntitySchemaNames.TREATMENT,
    fieldNames.treatment.DAYS_PER_CYCLE,
  ).valueType = dictionaryEntities.ValueType.NUMBER;

  const newDictionaries = _.concat(
    legacyStubSchemas.dictionaries.slice(0, 3) as Array<dictionaryEntities.SchemasDictionary>,
    [
      schemaV4,
      schemaV5,
      schemaV6,
      schemaV7,
      schemaV8,
      schemaV9,
      schemaV10,
      schemaV11,
      schemaV12,
      schemaV13,
      schemaV14,
      schemaV15,
      schemaV16,
    ],
  );
  // only want extend beyond the first three legacy schemas
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

buildDynamicStubSchema();
