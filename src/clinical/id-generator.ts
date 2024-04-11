/*
 * Copyright (c) 2024 The Ontario Institute for Cancer Research. All rights reserved
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

import axios from 'axios';
import memoize from 'memoizee';
import ms from 'ms';
import {
	Biomarker,
	ClinicalInfo,
	Comorbidity,
	CompletionStats,
	Donor,
	Exposure,
	FamilyHistory,
	FollowUp,
	PrimaryDiagnosis,
	SchemaMetadata,
	Specimen,
	Treatment,
} from './clinical-entities';
import { ClinicalEntitySchemaNames } from '../common-model/entities';
import { config } from '../config';

interface IdGenerationRequest {
	programId: string;
	submitterId: any;
	submitterDonorId: string;
	testInterval: string;
	family_relative_id: string;
	comorbidityTypeCode: string;
	entityType: string;
}

const request = {
	programId: 'null',
	submitterId: 'null',
	submitterDonorId: 'null',
	testInterval: 'null',
	family_relative_id: 'null',
	comorbidityTypeCode: 'null',
	entityType: 'null',
};

export interface PartialDonor {
	_id?: string;
	__v?: number; // mongodb property not being filtered out
	createBy?: string;
	schemaMetadata?: SchemaMetadata | undefined;
	donorId?: number;
	gender?: string;
	submitterId?: string;
	programId?: string;
	specimens?: Array<Specimen> | undefined;
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

export async function getId(req: IdGenerationRequest) {
	console.log('getId function called');
	const token = await getToken();
	const headers = {
		headers: {
			Authorization: 'Bearer ' + token,
		},
	};

	try {
		const response = await axios.get(
			// `http://localhost:9001/${req.programId}/${req.submitterId}/${req.submitterDonorId}/${req.testInterval}/${req.family_relative_id}/${req.comorbidityTypeCode}/${req.entityType}`,
			config.getConfig().tokenUrl() +
				`${req.programId}/${req.submitterId}/${req.submitterDonorId}/${req.testInterval}/${req.family_relative_id}/${req.comorbidityTypeCode}/${req.entityType}`,
			headers,
		);
		console.log('getId response: ' + response.data.entityId + ' - ' + response.data.entityType);
		return parseInt(response.data.entityId);
	} catch (e) {
		console.log(e);
		throw Error('Error fetching ids');
	}
}

export async function setEntityIdsForDonors(donors: Donor[]) {
	const donorsWithIds = donors.map(async (donor) => {
		return await setEntityIds(donor);
	});
	return await Promise.all(donorsWithIds);
}

export async function setEntityIds(donor: PartialDonor) {
	// -- DONOR --
	const donorId = await getId({
		...request,
		programId: donor.programId as string,
		submitterId: donor.submitterId as string,
		submitterDonorId: donor.submitterId as string,
		entityType: ClinicalEntitySchemaNames.DONOR,
	});
	donor.donorId = donorId;
	console.log(donor.donorId);

	// -- SPECIMEN --
	if (donor.specimens && donor.specimens.length > 0) {
		for (const specimen of donor.specimens) {
			const submitterId = !specimen.clinicalInfo.submitter_specimen_id
				? specimen.submitterId
				: specimen.clinicalInfo.submitter_specimen_id;
			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterId: submitterId as string,
				entityType: ClinicalEntitySchemaNames.SPECIMEN,
			});
			specimen.specimenId = id;
			console.log('specimen.specimenId: ' + specimen.specimenId);

			// -- SAMPLE --
			const samples = specimen.samples;
			for (const sample of samples) {
				const id = await getId({
					...request,
					programId: donor.programId as string,
					submitterId: sample.submitterId as string,
					entityType: ClinicalEntitySchemaNames.REGISTRATION,
				});
				sample.sampleId = id;
				console.log('sample.sampleId: ' + sample.sampleId);
			}
		}
	}

	// -- BIOMARKER --
	// submitter_specimen_id
	if (donor.biomarker && donor.biomarker.length > 0) {
		for (const bm of donor.biomarker) {
			const submitterBiomarkerId =
				bm.clinicalInfo.submitter_specimen_id?.toString() ??
				bm.clinicalInfo.submitter_primary_diagnosis_id?.toString() ??
				bm.clinicalInfo.submitter_follow_up_id?.toString() ??
				bm.clinicalInfo.submitter_treatment_id?.toString() ??
				'null';

			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterId: submitterBiomarkerId,
				submitterDonorId: bm.clinicalInfo.submitter_donor_id as string,
				testInterval: bm.clinicalInfo.test_interval as string,
				entityType: ClinicalEntitySchemaNames.BIOMARKER,
			});

			bm.biomarkerId = id;
			console.log('biomarkerId: ' + bm.biomarkerId);
		}
	}

	// -- COMORBIDITY --
	// submitter_donor_id and comorbidity_type_code - UK-confirm
	if (donor.comorbidity && donor.comorbidity.length > 0) {
		for (const cm of donor.comorbidity) {
			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterId: cm.clinicalInfo.submitter_donor_id as string,
				comorbidityTypeCode: cm.clinicalInfo.comorbidity_type_code as string,
				entityType: ClinicalEntitySchemaNames.COMORBIDITY,
			});
			cm.comorbidityId = id;
			console.log('comorbidityId: ' + cm.comorbidityId);
		}
	}

	// -- PRIMARY DIAGNOSIS --
	if (donor.primaryDiagnoses && donor.primaryDiagnoses.length > 0) {
		for (const p of donor.primaryDiagnoses) {
			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterId: p.clinicalInfo.submitter_primary_diagnosis_id as string,
				entityType: ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
			});
			p.primaryDiagnosisId = id;
			console.log('primaryDiagnosisId: ' + p.primaryDiagnosisId);
		}
	}

	// -- TREATMENT --
	if (donor.treatments && donor.treatments.length > 0) {
		for (const t of donor.treatments) {
			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterId: t.clinicalInfo.submitter_treatment_id as string,
				entityType: ClinicalEntitySchemaNames.TREATMENT,
			});
			t.treatmentId = id;
			console.log('treatmentId: ' + t.treatmentId);
		}
	}

	// -- FAMILY HISTORY --
	// submitter_donor_id and family_relative_id - UK: confirm
	if (donor.familyHistory && donor.familyHistory.length > 0) {
		for (const fh of donor.familyHistory) {
			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterId: fh.clinicalInfo.submitter_donor_id as string,
				family_relative_id: fh.clinicalInfo.family_relative_id as string,
				entityType: ClinicalEntitySchemaNames.FAMILY_HISTORY,
			});
			fh.familyHistoryId = id;
			console.log('familyHistoryId: ' + fh.familyHistoryId);
		}
	}

	// -- FOLLOW UP --
	if (donor.followUps && donor.followUps.length > 0) {
		for (const fl of donor.followUps) {
			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterId: fl.clinicalInfo.submitter_follow_up_id as string,
				entityType: ClinicalEntitySchemaNames.FOLLOW_UP,
			});
			fl.followUpId = id;
			console.log('followUpId: ' + fl.followUpId);
		}
	}

	// -- EXPOSURE --
	// submitter_donor_id
	if (donor.exposure && donor.exposure.length > 0) {
		for (const ex of donor.exposure) {
			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterId: ex.clinicalInfo.submitter_donor_id as string,
				entityType: ClinicalEntitySchemaNames.EXPOSURE,
			});
			ex.exposureId = id;
			console.log('exposureId: ' + ex.exposureId);
		}
	}

	return donor;
}

const getToken = memoize(
	async () => {
		const headers = {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		};
		const data = {
			grant_type: 'client_credentials',
			client_id: config.getConfig().egoClientId(),
			client_secret: config.getConfig().egoClientSecret(),
		};
		const response = await axios.post(config.getConfig().tokenUrl(), data, headers);
		console.log('token response: ' + response.data.access_token);
		response.data.access_token;
	},
	{
		maxAge: ms('1d'),
		preFetch: true,
	},
);
