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

import { Donor } from './clinical-entities';
import mongoose from 'mongoose';
import { DeepReadonly } from 'deep-freeze';
import { F, MongooseUtils, notEmpty } from '../utils';
export const SUBMITTER_ID = 'submitterId';
export const SPECIMEN_SUBMITTER_ID = 'specimen.submitterId';
export const SPECIMEN_SAMPLE_SUBMITTER_ID = 'specimen.sample.submitterId';
const AutoIncrement = require('mongoose-sequence')(mongoose);

export enum DONOR_DOCUMENT_FIELDS {
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
  PRIMARY_DIAGNOSIS_SUBMITTER_ID = 'primaryDiagnoses.clinicalInfo.submitter_primary_diagnosis_id',
  FAMILY_HISTORY_ID = 'familyHistory.clinicalInfo.family_relative_id',
}

export type FindByProgramAndSubmitterFilter = DeepReadonly<{
  programId: string;
  submitterId: string;
}>;

export interface DonorRepository {
  findByClinicalEntitySubmitterIdAndProgramId(
    filters: DeepReadonly<FindByProgramAndSubmitterFilter>,
    submitterIdFieldName: DONOR_DOCUMENT_FIELDS,
  ): Promise<DeepReadonly<Donor> | undefined>;
  insertDonors(donors: Donor[]): Promise<void>;
  updateDonor(donor: Donor): Promise<void>;
  findBy(criteria: any, limit: number): Promise<DeepReadonly<Donor[]>>;
  findByProgramId(
    programId: string,
    projections?: Partial<Record<DONOR_DOCUMENT_FIELDS, number>>,
    omitMongoDocIds?: boolean,
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
  async updateDonor(donor: Donor) {
    await mongoose.connection.db
      .collection('donors')
      .findOneAndUpdate({ donorId: donor.donorId }, { $set: donor });
  },
  async countBy(filter: any) {
    return await DonorModel.count(filter).exec();
  },

  async deleteByProgramId(programId: string): Promise<void> {
    await DonorModel.deleteMany({
      [DONOR_DOCUMENT_FIELDS.PROGRAM_ID]: programId,
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
    projection?: Partial<Record<DONOR_DOCUMENT_FIELDS, number>>,
    omitMongoDocIds?: boolean,
  ): Promise<DeepReadonly<Donor[]>> {
    if (omitMongoDocIds) {
      return findByProgramIdOmitMongoDocId(programId, projection);
    }

    const result = await DonorModel.find(
      {
        [DONOR_DOCUMENT_FIELDS.PROGRAM_ID]: programId,
      },
      projection,
      { sort: { [DONOR_DOCUMENT_FIELDS.DONOR_ID]: 1 } },
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
      [DONOR_DOCUMENT_FIELDS.SPECIMEN_SUBMITTER_ID]: filter.submitterId,
      [DONOR_DOCUMENT_FIELDS.PROGRAM_ID]: filter.programId,
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
      [DONOR_DOCUMENT_FIELDS.SPECIMEN_SAMPLE_SUBMITTER_ID]: filter.submitterId,
      [DONOR_DOCUMENT_FIELDS.PROGRAM_ID]: filter.programId,
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
    submitterIdFieldName: DONOR_DOCUMENT_FIELDS,
  ): Promise<DeepReadonly<Donor> | undefined> {
    const result = await DonorModel.find({
      [submitterIdFieldName]: filter.submitterId,
      [DONOR_DOCUMENT_FIELDS.PROGRAM_ID]: filter.programId,
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
    unsetIsNewFlagForUpdate(newDonor);

    await newDonor.save();
    return F(MongooseUtils.toPojo(newDonor));
  },

  async updateAll(donors: DeepReadonly<Donor>[]) {
    const newDonors = donors.map(donor => {
      const newDonor = new DonorModel(donor);
      unsetIsNewFlagForUpdate(newDonor);
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

function unsetIsNewFlagForUpdate(newDonor: Donor) {
  (newDonor as any).isNew = false;
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

  newDonor.primaryDiagnoses?.forEach(pd => {
    if (pd.primaryDiagnosisId) {
      (pd as any).isNew = false;
    }
  });

  newDonor.familyHistory?.forEach(fh => {
    if (fh.familyHistoryId) {
      (fh as any).isNew = false;
    }
  });

  newDonor.comorbidity?.forEach(cm => {
    if (cm.comorbidityId) {
      (cm as any).isNew = false;
    }
  });

  newDonor.followUps?.forEach(fu => {
    if (fu.followUpId) {
      (fu as any).isNew = false;
    }
  });

  newDonor.treatments?.forEach(tr => {
    if (tr.treatmentId) {
      (tr as any).isNew = false;
    }
  });

  newDonor.exposure?.forEach(ex => {
    if (ex.exposureId) {
      (ex as any).isNew = false;
    }
  });

  newDonor.biomarker?.forEach(bi => {
    if (bi.biomarkerId) {
      (bi as any).isNew = false;
    }
  });
}

// Like findByProgramId, but DocQuery asks mongo to return PoJo without docIds for faster fetch
async function findByProgramIdOmitMongoDocId(
  programId: string,
  projection?: Partial<Record<DONOR_DOCUMENT_FIELDS, number>>,
): Promise<DeepReadonly<Donor[]>> {
  const result = await DonorModel.find(
    {
      [DONOR_DOCUMENT_FIELDS.PROGRAM_ID]: programId,
    },
    projection,
    { sort: { [DONOR_DOCUMENT_FIELDS.DONOR_ID]: 1 } },
  )
    .select('-_id') // don't select '_id' so F() doesn't crash
    .lean() // ask mongo to return pojo only
    .exec();

  return F(result);
}

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
    therapyType: { type: String, required: true },
  },
  { _id: false },
);

const TreatmentSchema = new mongoose.Schema(
  {
    clinicalInfo: {},
    treatmentId: { type: Number },
    therapies: [TherapySchema],
  },
  { _id: false },
);
TreatmentSchema.index({ treatmentId: 1 }, { unique: true, sparse: true });
const FollowUpSchema = new mongoose.Schema(
  {
    followUpId: { type: Number },
    clinicalInfo: {},
  },
  { _id: false },
);
FollowUpSchema.index({ followUpId: 1 }, { unique: true, sparse: true });
const PrimaryDiagnosisSchema = new mongoose.Schema(
  {
    primaryDiagnosisId: { type: Number },
    clinicalInfo: {},
  },
  { _id: false },
);

PrimaryDiagnosisSchema.index({ primaryDiagnosisId: 1 }, { unique: true, sparse: true });

const FamilyHistorySchema = new mongoose.Schema(
  {
    familyHistoryId: { type: Number },
    clinicalInfo: {},
  },
  { _id: false },
);

FamilyHistorySchema.index({ familyHistoryId: 1 }, { unique: true, sparse: true });

const ExposureSchema = new mongoose.Schema(
  {
    exposureId: { type: Number },
    clinicalInfo: {},
  },
  { _id: false },
);

ExposureSchema.index({ exposureId: 1 }, { unique: true, sparse: true });

const BiomarkerSchema = new mongoose.Schema(
  {
    biomarkerId: { type: Number },
    clinicalInfo: {},
  },
  { _id: false },
);

BiomarkerSchema.index({ biomarkerId: 1 }, { unique: true, sparse: true });

const ComorbiditySchema = new mongoose.Schema(
  {
    comorbidityId: { type: Number },
    clinicalInfo: {},
  },
  { _id: false },
);

ComorbiditySchema.index({ comorbidityId: 1 }, { unique: true, sparse: true });

const DonorSchema = new mongoose.Schema(
  {
    donorId: { type: Number, index: true, unique: true, get: prefixDonorId },
    gender: { type: String, required: true },
    submitterId: { type: String, required: true },
    programId: { type: String, required: true },
    specimens: [SpecimenSchema],
    clinicalInfo: {},
    primaryDiagnoses: [PrimaryDiagnosisSchema],
    familyHistory: [FamilyHistorySchema],
    comorbidity: [ComorbiditySchema],
    followUps: [FollowUpSchema],
    treatments: [TreatmentSchema],
    exposure: [ExposureSchema],
    biomarker: [BiomarkerSchema],
    schemaMetadata: {},
    completionStats: {},
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

FollowUpSchema.plugin(AutoIncrement, {
  inc_field: 'followUpId',
  start_seq: 1,
});

PrimaryDiagnosisSchema.plugin(AutoIncrement, {
  inc_field: 'primaryDiagnosisId',
  start_seq: 1,
});

FamilyHistorySchema.plugin(AutoIncrement, {
  inc_field: 'familyHistoryId',
  start_seq: 1,
});

ExposureSchema.plugin(AutoIncrement, {
  inc_field: 'exposureId',
  start_seq: 1,
});

BiomarkerSchema.plugin(AutoIncrement, {
  inc_field: 'biomarkerId',
  start_seq: 1,
});

ComorbiditySchema.plugin(AutoIncrement, {
  inc_field: 'comorbidityId',
  start_seq: 1,
});

TreatmentSchema.plugin(AutoIncrement, {
  inc_field: 'treatmentId',
  start_seq: 1,
});

export let DonorModel = mongoose.model<DonorDocument>('Donor', DonorSchema);
