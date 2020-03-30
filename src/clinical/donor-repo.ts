import { Donor } from './clinical-entities';
import mongoose from 'mongoose';
import { DeepReadonly } from 'deep-freeze';
import { F, MongooseUtils, notEmpty } from '../utils';
import { loggerFor } from '../logger';
import { ClinicalEntitySchemaNames } from '../../src/submission/submission-entities';

export const SUBMITTER_ID = 'submitterId';
export const SPECIMEN_SUBMITTER_ID = 'specimen.submitterId';
export const SPECIMEN_SAMPLE_SUBMITTER_ID = 'specimen.sample.submitterId';
const L = loggerFor(__filename);
const AutoIncrement = require('mongoose-sequence')(mongoose);

export enum DONOR_FIELDS {
  SUBMITTER_ID = 'submitterId',
  DONOR_ID = 'donorId',
  SPECIMEN_SUBMITTER_ID = 'specimens.submitterId',
  SPECIMEN_SAMPLE_SUBMITTER_ID = 'specimens.samples.submitterId',
  FOLLOWUP_SUBMITTER_ID = 'followUps.clinicalInfo.submitter_follow_up_id',
  TREATMENT_SUBMITTER_ID = 'treatments.clinicalInfo.submitter_treatment_id',
  PROGRAM_ID = 'programId',
  LAST_MIGRATION_ID = 'schemaMetadata.lastMigrationId',
  GENDER = 'gender',
  SPECIMEN_TISSUE_SOURCE = 'specimens.specimenTissueSource',
  SPECIMEN_TYPE = 'specimens.specimenType',
  SPECIMEN_TUMOR_NORMAL_DESIGNATION = 'specimens.tumourNormalDesignation',
  SAMPLE_TYPE = 'specimens.samples.sampleType',
}

const ClinicalEntitySchemaNameToDonoFieldsMap: { [clinicalType: string]: DONOR_FIELDS } = {
  [ClinicalEntitySchemaNames.TREATMENT]: DONOR_FIELDS.TREATMENT_SUBMITTER_ID,
  [ClinicalEntitySchemaNames.FOLLOW_UP]: DONOR_FIELDS.FOLLOWUP_SUBMITTER_ID,
};

export type FindByProgramAndSubmitterFilter = DeepReadonly<{
  programId: string;
  submitterId: string;
}>;

export interface DonorRepository {
  findByClinicalEntitySubmitterIdAndProgramId(
    filters: DeepReadonly<FindByProgramAndSubmitterFilter>,
    clinicalEntityType: ClinicalEntitySchemaNames,
  ): Promise<DeepReadonly<Donor> | undefined>;
  insertDonors(donors: Donor[]): Promise<void>;
  findBy(criteria: any, limit: number): Promise<DeepReadonly<Donor[]>>;
  findByProgramId(
    programId: string,
    projections?: Partial<Record<DONOR_FIELDS, number>>,
  ): Promise<DeepReadonly<Donor[]>>;
  deleteByProgramId(programId: string): Promise<void>;
  findByProgramAndSubmitterId(
    filters: DeepReadonly<FindByProgramAndSubmitterFilter[]>,
  ): Promise<DeepReadonly<Donor[]> | undefined>;
  findByProgramAndSubmitterIds(
    programId: string,
    submitterIds: string[],
  ): Promise<DeepReadonly<Donor[]> | undefined>;
  findBySpecimenSubmitterIdAndProgramId(
    filter: FindByProgramAndSubmitterFilter,
  ): Promise<DeepReadonly<Donor> | undefined>;
  findBySampleSubmitterIdAndProgramId(
    filter: FindByProgramAndSubmitterFilter,
  ): Promise<DeepReadonly<Donor> | undefined>;
  create(donor: DeepReadonly<Donor>): Promise<DeepReadonly<Donor>>;
  update(donor: DeepReadonly<Donor>): Promise<DeepReadonly<Donor>>;
  updateAll(donors: DeepReadonly<Donor>[]): Promise<DeepReadonly<Donor>[]>;
  countBy(filter: any): Promise<number>;
}

// Mongoose implementation of the DonorRepository
export const donorDao: DonorRepository = {
  async insertDonors(donors: Donor[]) {
    await mongoose.connection.db.collection('donors').insertMany(donors);
  },
  async countBy(filter: any) {
    return await DonorModel.count(filter).exec();
  },

  async deleteByProgramId(programId: string): Promise<void> {
    await DonorModel.deleteMany({
      [DONOR_FIELDS.PROGRAM_ID]: programId,
    }).exec();
  },

  async findBy(criteria: any, limit: number) {
    const result = await DonorModel.find(criteria)
      .limit(limit)
      .exec();
    // convert the id to string to avoid runtime error on freezing
    const mapped = result
      .map((d: DonorDocument) => {
        return MongooseUtils.toPojo(d);
      })
      .filter(notEmpty);
    return F(mapped);
  },

  async findByProgramId(
    programId: string,
    projection?: Partial<Record<DONOR_FIELDS, number>>,
  ): Promise<DeepReadonly<Donor[]>> {
    const result = await DonorModel.find(
      {
        [DONOR_FIELDS.PROGRAM_ID]: programId,
      },
      projection,
      { sort: { [DONOR_FIELDS.DONOR_ID]: 1 } },
    ).exec();

    // convert the id to string to avoid runtime error on freezing
    const mapped = result
      .map((d: DonorDocument) => {
        return MongooseUtils.toPojo(d);
      })
      .filter(notEmpty);
    return F(mapped);
  },

  async findBySpecimenSubmitterIdAndProgramId(
    filter: FindByProgramAndSubmitterFilter,
  ): Promise<DeepReadonly<Donor> | undefined> {
    const result = await DonorModel.find({
      [DONOR_FIELDS.SPECIMEN_SUBMITTER_ID]: filter.submitterId,
      [DONOR_FIELDS.PROGRAM_ID]: filter.programId,
    }).exec();
    if (!result) {
      return undefined;
    }
    // convert the id to string to avoid runtime error on freezing
    const mapped = result.map((d: DonorDocument) => {
      return MongooseUtils.toPojo(d) as Donor;
    });
    if (mapped.length == 0) {
      return undefined;
    }
    return F(mapped[0]);
  },
  async findBySampleSubmitterIdAndProgramId(
    filter: FindByProgramAndSubmitterFilter,
  ): Promise<DeepReadonly<Donor> | undefined> {
    const result = await DonorModel.find({
      [DONOR_FIELDS.SPECIMEN_SAMPLE_SUBMITTER_ID]: filter.submitterId,
      [DONOR_FIELDS.PROGRAM_ID]: filter.programId,
    }).exec();

    if (!result) {
      return undefined;
    }
    // convert the id to string to avoid runtime error on freezing
    const mapped = result.map((d: DonorDocument) => {
      return MongooseUtils.toPojo(d) as Donor;
    });
    if (mapped.length == 0) {
      return undefined;
    }
    return F(mapped[0]);
  },

  async findByClinicalEntitySubmitterIdAndProgramId(
    filter: DeepReadonly<FindByProgramAndSubmitterFilter>,
    clinicalEntityType: ClinicalEntitySchemaNames,
  ): Promise<DeepReadonly<Donor> | undefined> {
    const result = await DonorModel.find({
      [ClinicalEntitySchemaNameToDonoFieldsMap[clinicalEntityType]]: filter.submitterId,
      [DONOR_FIELDS.PROGRAM_ID]: filter.programId,
    }).exec();

    if (!result) {
      return undefined;
    }
    // convert the id to string to avoid runtime error on freezing
    const mapped = result.map((d: DonorDocument) => {
      return MongooseUtils.toPojo(d) as Donor;
    });
    if (mapped.length == 0) {
      return undefined;
    }
    return F(mapped[0]);
  },

  async findByProgramAndSubmitterId(
    filter: { programId: string; submitterId: string }[],
  ): Promise<DeepReadonly<Donor[]> | undefined> {
    const result = await DonorModel.find({
      $or: [...filter],
    }).exec();
    // convert the id to string to avoid runtime error on freezing
    const mapped = result.map((d: DonorDocument) => {
      return MongooseUtils.toPojo(d);
    });
    return F(mapped);
  },
  async findByProgramAndSubmitterIds(
    programId: string,
    submitterIds: string[],
  ): Promise<DeepReadonly<Donor[]> | undefined> {
    const result = await DonorModel.find({
      submitterId: { $in: submitterIds },
      programId: programId,
    });
    const mapped = result.map((d: DonorDocument) => {
      return MongooseUtils.toPojo(d);
    });
    return F(mapped);
  },

  async update(donor: DeepReadonly<Donor>) {
    const newDonor = new DonorModel(donor);
    newDonor.isNew = false;
    newDonor.specimens.forEach(sp => {
      if (sp.specimenId) {
        (sp as any).isNew = false;
      }

      sp.samples.forEach(sa => {
        if (sa.sampleId) {
          (sa as any).isNew = false;
        }
      });
    });
    await newDonor.save();
    return F(MongooseUtils.toPojo(newDonor));
  },
  async updateAll(donors: DeepReadonly<Donor>[]) {
    const newDonors = donors.map(donor => {
      const newDonor = new DonorModel(donor);
      newDonor.isNew = false;
      newDonor.specimens.forEach(sp => {
        if (sp.specimenId) {
          (sp as any).isNew = false;
        }

        sp.samples.forEach(sa => {
          if (sa.sampleId) {
            (sa as any).isNew = false;
          }
        });
      });
      return newDonor;
    });

    const results = await Promise.all(newDonors.map(donor => donor.save()));
    return newDonors.map(donor => F(MongooseUtils.toPojo(donor)));
  },

  async create(donor: DeepReadonly<Donor>) {
    const newDonor = new DonorModel(donor);
    const doc = await newDonor.save();
    return F(MongooseUtils.toPojo(newDonor));
  },
};

type DonorDocument = mongoose.Document & Donor;

const SampleSchema = new mongoose.Schema(
  {
    sampleId: { type: Number, index: true, unique: true, get: prefixSampleId },
    sampleType: { type: String },
    submitterId: { type: String, required: true },
  },
  { _id: false },
);

const SpecimenSchema = new mongoose.Schema(
  {
    specimenId: { type: Number, index: true, unique: true, get: prefixSpecimenId },
    specimenTissueSource: { type: String },
    clinicalInfo: {},
    clinicalInfoStats: {},
    tumourNormalDesignation: String,
    specimenType: String,
    submitterId: { type: String, required: true },
    samples: [SampleSchema],
  },
  { _id: false, minimize: false }, // minimize false is to avoid omitting clinicalInfo:{}
);

const TherapySchema = new mongoose.Schema(
  {
    clinicalInfo: {},
    clinicalInfoStats: {},
    therapyType: { type: String, required: true },
  },
  { _id: false },
);

const TreatmentSchema = new mongoose.Schema(
  {
    clinicalInfo: {},
    clinicalInfoStats: {},
    therapies: [TherapySchema],
  },
  { _id: false },
);

const FollowUpSchema = new mongoose.Schema(
  {
    clinicalInfo: {},
    clinicalInfoStats: {},
  },
  { _id: false },
);

const PrimaryDiagnosisSchema = new mongoose.Schema(
  {
    clinicalInfo: {},
    clinicalInfoStats: {},
  },
  { _id: false },
);

const DonorSchema = new mongoose.Schema(
  {
    donorId: { type: Number, index: true, unique: true, get: prefixDonorId },
    gender: { type: String, required: true },
    submitterId: { type: String, required: true },
    programId: { type: String, required: true },
    specimens: [SpecimenSchema],
    clinicalInfo: {},
    clinicalInfoStats: {},
    primaryDiagnosis: PrimaryDiagnosisSchema,
    followUps: [FollowUpSchema],
    treatments: [TreatmentSchema],
    schemaMetadata: {},
    aggregatedInfoStats: {},
  },
  { timestamps: true, minimize: false }, // minimize false is to avoid omitting clinicalInfo:{}
);

function prefixDonorId(id: any) {
  if (!id) return undefined;
  return `DO${id}`;
}

function prefixSpecimenId(id: any) {
  if (!id) return undefined;
  return `SP${id}`;
}

function prefixSampleId(id: any) {
  if (!id) return undefined;
  return `SA${id}`;
}

DonorSchema.index({ submitterId: 1, programId: 1 }, { unique: true });
DonorSchema.index({ 'specimens.submitterId': 1, programId: 1 }, { unique: true });
DonorSchema.index({ 'specimens.samples.submitterId': 1, programId: 1 }, { unique: true });

/**
 * These had to read from process env and not use the AppConfig
 * because these are global mongoose variables, they can't be called
 * multiple times, and that makes them hard to test because tests depend
 * on resetting the config and bootstraping but global variables keep their state.
 */
DonorSchema.plugin(AutoIncrement, {
  inc_field: 'donorId',
  start_seq: process.env.DONOR_ID_SEED || 250000,
});

SpecimenSchema.plugin(AutoIncrement, {
  inc_field: 'specimenId',
  start_seq: process.env.SPECIMEN_ID_SEED || 210000,
});

SampleSchema.plugin(AutoIncrement, {
  inc_field: 'sampleId',
  start_seq: process.env.SAMPLE_ID_SEED || 610000,
});

export let DonorModel = mongoose.model<DonorDocument>('Donor', DonorSchema);
