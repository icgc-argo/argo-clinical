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

ComorbiditySchema.index({ comorbidityId: 1 }, { unique: true, sparse: true });

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

export type DonorDocument = mongoose.Document & Donor;
