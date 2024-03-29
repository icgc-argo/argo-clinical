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

import { DeepReadonly } from 'deep-freeze';
import { ClinicalEntitySchemaNames } from '../common-model/entities';

export interface Donor {
	_id?: string;
	__v?: number; // mongodb property not being filtered out
	createBy?: string;
	schemaMetadata: SchemaMetadata;
	donorId: number;
	gender: string;
	submitterId: string;
	programId: string;
	specimens: Array<Specimen>;
	clinicalInfo?: ClinicalInfo;
	primaryDiagnoses?: Array<PrimaryDiagnosis>;
	familyHistory?: Array<FamilyHistory>;
	comorbidity?: Array<Comorbidity>;
	followUps?: Array<FollowUp>;
	treatments?: Array<Treatment>;
	exposure?: Array<Exposure>;
	biomarker?: Array<Biomarker>;
	createdAt?: string;
	updatedAt?: string;
	completionStats?: CompletionStats;
}

export interface CompletionStats {
	coreCompletion: CoreCompletionFields;
	coreCompletionDate?: string;
	coreCompletionPercentage: number;
	hasMissingEntityException?: boolean;
}

export interface SchemaMetadata {
	lastMigrationId?: string | undefined | null;
	lastValidSchemaVersion: string;
	originalSchemaVersion: string;
	isValid: boolean;
}

export type ClinicalEntity = {
	clinicalInfo: ClinicalInfo;
	[k: string]: any;
};

export interface Specimen extends ClinicalEntity {
	samples: Array<Sample>;
	specimenTissueSource: string;
	submitterId: string;
	specimenId?: number;
	tumourNormalDesignation: string;
	specimenType: string;
}

export interface Sample {
	sampleId?: number;
	sampleType: string;
	submitterId: string;
}

export const dnaSampleTypes = ['Amplified DNA', 'ctDNA', 'Other DNA enrichments', 'Total DNA'];

export interface Treatment extends ClinicalEntity {
	treatmentId: number | undefined;
	therapies: Array<Therapy>;
}

export interface Therapy extends ClinicalEntity {
	therapyType: string;
}

export interface FollowUp extends ClinicalEntity {
	followUpId: number | undefined;
}

export interface PrimaryDiagnosis extends ClinicalEntity {
	primaryDiagnosisId: number | undefined;
}

export interface FamilyHistory extends ClinicalEntity {
	familyHistoryId: number | undefined;
}

export interface Exposure extends ClinicalEntity {
	exposureId: number | undefined;
}

export interface Biomarker extends ClinicalEntity {
	biomarkerId: number | undefined;
}

export interface Comorbidity extends ClinicalEntity {
	comorbidityId: number | undefined;
}

export interface ClinicalInfo {
	[field: string]: string | number | boolean | string[] | number[] | boolean[] | undefined;
}

export type ClinicalEntityData = {
	entityName: ClinicalEntitySchemaNames;
	totalDocs: number;
	records: Array<ClinicalInfo>;
	entityFields: string[];
	completionStats?: CompletionDisplayRecord[];
};

export type DonorMap = Readonly<{ [submitterId: string]: Donor }>;

export type DonorBySubmitterIdMap = { [k: string]: DeepReadonly<Donor> };

export interface CoreCompletionFields {
	donor: number;
	specimens: number;
	primaryDiagnosis: number;
	followUps: number;
	treatments: number;
}

export interface SpecimenCoreCompletion {
	coreCompletionPercentage: number;
	normalSpecimensPercentage: number;
	tumourSpecimensPercentage: number;
	normalRegistrations: number;
	normalSubmissions: number;
	tumourRegistrations: number;
	tumourSubmissions: number;
}

export interface CompletionDisplayRecord extends CompletionStats {
	donorId?: number;
	entityData?: { specimens?: SpecimenCoreCompletion };
}

export type CoreClinicalEntities = keyof CoreCompletionFields;
