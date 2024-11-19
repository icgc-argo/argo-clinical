/*
 * Copyright (c) 2023 The Ontario Institute for Cancer Research. All rights reserved
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

import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { Donor } from './clinical-entities';

const AutoIncrement = require('mongoose-sequence')(mongoose);

export const SampleSchema = new mongoose.Schema(
	{
		sampleId: { type: Number, index: true, unique: true },
		sampleType: { type: String },
		submitterId: { type: String, required: true },
	},
	{ _id: false },
);

export const SpecimenSchema = new mongoose.Schema(
	{
		specimenId: { type: Number, index: true, unique: true },
		specimenTissueSource: { type: String },
		clinicalInfo: {},
		tumourNormalDesignation: String,
		specimenType: String,
		submitterId: { type: String, required: true },
		samples: [SampleSchema],
	},
	{ _id: false, minimize: false }, // minimize false is to avoid omitting clinicalInfo:{}
);

export const TherapySchema = new mongoose.Schema(
	{
		clinicalInfo: {},
		therapyType: { type: String, required: true },
	},
	{ _id: false },
);

export const TreatmentSchema = new mongoose.Schema(
	{
		clinicalInfo: {},
		treatmentId: { type: Number },
		therapies: [TherapySchema],
	},
	{ _id: false },
);
TreatmentSchema.index({ treatmentId: 1 }, { unique: true, sparse: true });

export const FollowUpSchema = new mongoose.Schema(
	{
		followUpId: { type: Number },
		clinicalInfo: {},
	},
	{ _id: false },
);
FollowUpSchema.index({ followUpId: 1 }, { unique: true, sparse: true });

export const PrimaryDiagnosisSchema = new mongoose.Schema(
	{
		primaryDiagnosisId: { type: Number },
		clinicalInfo: {},
	},
	{ _id: false },
);

PrimaryDiagnosisSchema.index({ primaryDiagnosisId: 1 }, { unique: true, sparse: true });

export const FamilyHistorySchema = new mongoose.Schema(
	{
		familyHistoryId: { type: Number },
		clinicalInfo: {},
	},
	{ _id: false },
);

FamilyHistorySchema.index({ familyHistoryId: 1 }, { unique: true, sparse: true });

export const ExposureSchema = new mongoose.Schema(
	{
		exposureId: { type: Number },
		clinicalInfo: {},
	},
	{ _id: false },
);

ExposureSchema.index({ exposureId: 1 }, { unique: true, sparse: true });

export const BiomarkerSchema = new mongoose.Schema(
	{
		biomarkerId: { type: Number },
		clinicalInfo: {},
	},
	{ _id: false },
);

BiomarkerSchema.index({ biomarkerId: 1 }, { unique: true, sparse: true });

export const ComorbiditySchema = new mongoose.Schema(
	{
		comorbidityId: { type: Number },
		clinicalInfo: {},
	},
	{ _id: false },
);

export const DonorSchema = new mongoose.Schema(
	{
		donorId: { type: Number, index: true, unique: true },
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
).plugin(mongoosePaginate);

DonorSchema.index({ submitterId: 1, programId: 1 }, { unique: true });
DonorSchema.index({ 'specimens.submitterId': 1, programId: 1 }, { unique: true });
DonorSchema.index({ 'specimens.samples.submitterId': 1, programId: 1 }, { unique: true });

export type DonorDocument = mongoose.Document & Donor;

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

DonorSchema.plugin(mongoosePaginate);

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
