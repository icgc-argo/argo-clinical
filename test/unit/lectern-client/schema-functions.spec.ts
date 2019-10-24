import chai from 'chai';
import * as schemaService from '../../../src/lectern-client/schema-functions';
import {
  SchemasDictionary,
  SchemaValidationErrorTypes,
} from '../../../src/lectern-client/schema-entities';
chai.should();
const schema: SchemasDictionary = require('./schema.json')[0];

describe('schema-functions', () => {
  it('should populate records based on default value ', () => {
    const result = schemaService.process(schema, 'registration', [
      {
        program_id: 'PEME-CA',
        submitter_donor_id: 'OD1234',
        gender: '',
        submitter_specimen_id: '87813',
        specimen_type: 'Skin',
        tumour_normal_designation: 'Normal',
        submitter_sample_id: 'MAS123',
        sample_type: 'ctDNA',
      },
      {
        program_id: 'PEME-CA',
        submitter_donor_id: 'OD1234',
        gender: '',
        submitter_specimen_id: '87812',
        specimen_type: 'Skin',
        tumour_normal_designation: 'Normal',
        submitter_sample_id: 'MAS1234',
        sample_type: 'ctDNA',
      },
    ]);
    chai.expect(result.processedRecords[0].gender).to.eq('Other');
    chai.expect(result.processedRecords[1].gender).to.eq('Other');
  });

  it('should NOT populate missing columns based on default value ', () => {
    const result = schemaService.process(schema, 'registration', [
      {
        program_id: 'PEME-CA',
        submitter_donor_id: 'OD1234',
        gendr: '',
        submitter_specimen_id: '87813',
        specimen_type: 'Skin',
        tumour_normal_designation: 'Normal',
        submitter_sample_id: 'MAS123',
        sample_type: 'ctDNA',
      },
      {
        program_id: 'PEME-CA',
        submitter_donor_id: 'OD1234',
        gender: '',
        submitter_specimen_id: '87812',
        specimen_type: 'Skin',
        tumour_normal_designation: 'Normal',
        submitter_sample_id: 'MAS1234',
        sample_type: 'ctDNA',
      },
    ]);
    chai.expect(result.validationErrors).to.deep.include({
      errorType: SchemaValidationErrorTypes.MISSING_REQUIRED_FIELD,
      fieldName: 'gender',
      index: 0,
      info: {},
    });
  });

  it('should validate required', () => {
    const result = schemaService.process(schema, 'registration', [
      {
        submitter_donor_id: 'OD1234',
        gender: 'Female',
        submitter_specimen_id: '87813',
        specimen_type: 'Skin',
        tumour_normal_designation: 'Normal',
        submitter_sample_id: 'MAS123',
        sample_type: 'ctDNA',
      },
    ]);
    chai.expect(result.validationErrors).to.deep.include({
      errorType: SchemaValidationErrorTypes.MISSING_REQUIRED_FIELD,
      fieldName: 'program_id',
      index: 0,
      info: {},
    });
  });

  it('should validate value types', () => {
    const result = schemaService.process(schema, 'address', [
      {
        country: 'US',
        unit_number: 'abc',
        postal_code: '12345',
      },
    ]);
    chai.expect(result.validationErrors).to.deep.include({
      errorType: SchemaValidationErrorTypes.INVALID_FIELD_VALUE_TYPE,
      fieldName: 'unit_number',
      index: 0,
      info: {},
    });
  });

  it('should convert string to integer after processing', () => {
    const result = schemaService.process(schema, 'address', [
      {
        country: 'US',
        unit_number: '123',
        postal_code: '12345',
      },
    ]);
    chai.expect(result.processedRecords).to.deep.include({
      country: 'US',
      unit_number: 123,
      postal_code: '12345',
    });
  });

  it('should validate regex', () => {
    const result = schemaService.process(schema, 'registration', [
      {
        program_id: 'PEME-CAA',
        submitter_donor_id: 'OD1234',
        gender: 'Female',
        submitter_specimen_id: '87813',
        specimen_type: 'Skin',
        tumour_normal_designation: 'Normal',
        submitter_sample_id: 'MAS123',
        sample_type: 'ctDNA',
      },
    ]);
    chai.expect(result.validationErrors).to.deep.include({
      errorType: SchemaValidationErrorTypes.INVALID_BY_REGEX,
      fieldName: 'program_id',
      index: 0,
      info: {},
    });
  });

  it('should validate script', () => {
    const result = schemaService.process(schema, 'address', [
      {
        country: 'US',
        postal_code: '12',
      },
      {
        country: 'CANADA',
        postal_code: 'ABC',
      },
      {
        country: 'US',
        postal_code: '15523',
      },
    ]);
    chai.expect(result.validationErrors.length).to.eq(2);
    chai.expect(result.validationErrors).to.deep.include({
      errorType: SchemaValidationErrorTypes.INVALID_BY_SCRIPT,
      fieldName: 'postal_code',
      index: 0,
      info: { message: 'invalid postal code for US' },
    });
    chai.expect(result.validationErrors).to.deep.include({
      errorType: SchemaValidationErrorTypes.INVALID_BY_SCRIPT,
      fieldName: 'postal_code',
      index: 1,
      info: { message: 'invalid postal code for CANADA' },
    });
  });

  it('should validate if non-required feilds are not provided', () => {
    const result = schemaService.process(schema, 'donor', [
      // optional enum field not provided
      {
        program_id: 'PACA-AU',
        submitter_donor_id: 'ICGC_0004',
        gender: 'Female',
        ethnicity: 'black or african american',
        vital_status: 'alive',
      },
      // optional enum field provided with proper value
      {
        program_id: 'PACA-AU',
        submitter_donor_id: 'ICGC_0002',
        gender: 'Male',
        ethnicity: 'asian',
        vital_status: 'deceased',
        cause_of_death: 'died of cancer',
        survival_time: '124',
      },
      // optional enum field provided with no value
      {
        program_id: 'PACA-AU',
        submitter_donor_id: 'ICGC_0002',
        gender: 'Male',
        ethnicity: 'asian',
        vital_status: 'deceased',
        cause_of_death: '',
        survival_time: '124',
      },
    ]);
    chai.expect(result.validationErrors.length).to.eq(0);
  });

  it('should error if integer fields are not valid', () => {
    const result = schemaService.process(schema, 'donor', [
      {
        program_id: 'PACA-AU',
        submitter_donor_id: 'ICGC_0002',
        gender: 'Other',
        ethnicity: 'asian',
        vital_status: 'deceased',
        cause_of_death: 'died of cancer',
        survival_time: '0.5',
      },
    ]);
    chai.expect(result.validationErrors.length).to.eq(1);
    chai.expect(result.validationErrors).to.deep.include({
      errorType: SchemaValidationErrorTypes.INVALID_FIELD_VALUE_TYPE,
      fieldName: 'survival_time',
      index: 0,
      info: {},
    });
  });

  it('should validate case insensitive enums, return proper format', () => {
    const result = schemaService.process(schema, 'registration', [
      {
        program_id: 'PACA-AU',
        submitter_donor_id: 'OD1234',
        gender: 'feMale',
        submitter_specimen_id: '87813',
        specimen_type: 'sKiN',
        tumour_normal_designation: 'Normal',
        submitter_sample_id: 'MAS123',
        sample_type: 'CTdna',
      },
    ]);
    chai.expect(result.validationErrors.length).to.eq(0);
    chai.expect(result.processedRecords[0]).to.deep.eq({
      program_id: 'PACA-AU',
      submitter_donor_id: 'OD1234',
      gender: 'Female',
      submitter_specimen_id: '87813',
      specimen_type: 'Skin',
      tumour_normal_designation: 'Normal',
      submitter_sample_id: 'MAS123',
      sample_type: 'ctDNA',
    });
  });
});
