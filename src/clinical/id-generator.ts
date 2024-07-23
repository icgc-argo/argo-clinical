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
import { Donor } from './clinical-entities';
import { ClinicalEntitySchemaNames } from '../common-model/entities';
import { config } from '../config';
import { Errors } from '../utils';

interface IdGenerationRequest {
	programId: string;
	submitterSpecimenId: string;
	submitterSampleId: string;
	submitterPrimaryDiagnosisId: string;
	submitterFollowUpId: string;
	submitterTreatmentId: string;
	submitterDonorId: string;
	testInterval: string;
	family_relative_id: string;
	comorbidityTypeCode: string;
	entityType: string;
}

const request = {
	programId: '-',
	submitterSpecimenId: '-',
	submitterSampleId: '-',
	submitterPrimaryDiagnosisId: '-',
	submitterFollowUpId: '-',
	submitterTreatmentId: '-',
	submitterDonorId: '-',
	testInterval: '-',
	family_relative_id: '-',
	comorbidityTypeCode: '-',
	entityType: '-',
};

export interface PartialDonor extends Partial<Donor> {}

export async function getId(req: IdGenerationRequest) {
	console.log('getId function called: ' + req.submitterDonorId);
	const token = await getToken();
	const headers = {
		headers: {
			Authorization: 'Bearer ' + token,
		},
	};

	let response;
	try {
		const url =
			config.getConfig().idServiceUrl() +
			`${req.programId}/${req.submitterDonorId}/${req.submitterSpecimenId}/${req.submitterSampleId}/${req.submitterPrimaryDiagnosisId}/${req.submitterFollowUpId}/${req.submitterTreatmentId}/${req.testInterval}/${req.family_relative_id}/${req.comorbidityTypeCode}/${req.entityType}`;
		response = await axios.get(url, headers);
		console.log('getId response: ' + response.data.entityId + ' - ' + response.data.entityType);
	} catch (e) {
		throw new Errors.NetworkError('Error sending request to ID service. Caused by: ' + e);
	}
	if (!response.data.entityId) {
		throw new Errors.IdGenerationError('Error generating entity ids.');
	}
	return parseInt(response.data.entityId);
}

export async function setEntityIdsForDonors(donors: Donor[]) {
	const donorsWithIds = donors.map(async (donor) => {
		return await setEntityIds(donor);
	});
	return await Promise.all(donorsWithIds);
}

export async function setEntityIds(donor: PartialDonor) {
	const submitterDonorId = donor.submitterId as string;
	// -- DONOR --
	const donorId = await getId({
		...request,
		programId: donor.programId as string,
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
				submitterSpecimenId: submitterId as string,
				submitterDonorId,
				entityType: ClinicalEntitySchemaNames.SPECIMEN,
			});
			specimen.specimenId = id;

			// -- SAMPLE --
			const samples = specimen.samples;
			for (const sample of samples) {
				const id = await getId({
					...request,
					programId: donor.programId as string,
					submitterSampleId: sample.submitterId as string,
					submitterSpecimenId: specimen.submitterId,
					submitterDonorId,
					entityType: ClinicalEntitySchemaNames.REGISTRATION,
				});
				sample.sampleId = id;
			}
		}
	}

	// -- BIOMARKER --
	if (donor.biomarker && donor.biomarker.length > 0) {
		for (const biomarker of donor.biomarker) {
			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterSpecimenId: biomarker.clinicalInfo.submitter_specimen_id?.toString() || '-',
				submitterPrimaryDiagnosisId:
					biomarker.clinicalInfo.submitter_primary_diagnosis_id?.toString() || '-',
				submitterFollowUpId: biomarker.clinicalInfo.submitter_follow_up_id?.toString() || '-',
				submitterTreatmentId: biomarker.clinicalInfo.submitter_treatment_id?.toString() || '-',
				submitterDonorId,
				testInterval: biomarker.clinicalInfo.test_interval?.toString() || '-',
				entityType: ClinicalEntitySchemaNames.BIOMARKER,
			});
			biomarker.biomarkerId = id;
		}
	}

	// -- COMORBIDITY --
	if (donor.comorbidity && donor.comorbidity.length > 0) {
		for (const comorbidity of donor.comorbidity) {
			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterDonorId,
				comorbidityTypeCode: comorbidity.clinicalInfo.comorbidity_type_code as string,
				entityType: ClinicalEntitySchemaNames.COMORBIDITY,
			});
			comorbidity.comorbidityId = id;
		}
	}

	// -- PRIMARY DIAGNOSIS --
	if (donor.primaryDiagnoses && donor.primaryDiagnoses.length > 0) {
		for (const primaryDiagnosis of donor.primaryDiagnoses) {
			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterPrimaryDiagnosisId: primaryDiagnosis.clinicalInfo
					.submitter_primary_diagnosis_id as string,
				submitterDonorId,
				entityType: ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
			});
			primaryDiagnosis.primaryDiagnosisId = id;
		}
	}

	// -- TREATMENT --
	if (donor.treatments && donor.treatments.length > 0) {
		for (const treatment of donor.treatments) {
			const submitter_treatment_id = treatment.clinicalInfo?.submitter_treatment_id?.toString();
			const therapy_submitter_treatment_id = treatment.therapies[0]?.clinicalInfo?.submitter_treatment_id?.toString();
			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterTreatmentId: (!submitter_treatment_id
					? therapy_submitter_treatment_id
					: submitter_treatment_id) as string,
				submitterDonorId,
				entityType: ClinicalEntitySchemaNames.TREATMENT,
			});
			treatment.treatmentId = id;
		}
	}

	// -- FAMILY HISTORY --
	if (donor.familyHistory && donor.familyHistory.length > 0) {
		for (const familyHistory of donor.familyHistory) {
			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterDonorId,
				family_relative_id: familyHistory.clinicalInfo.family_relative_id as string,
				entityType: ClinicalEntitySchemaNames.FAMILY_HISTORY,
			});
			familyHistory.familyHistoryId = id;
		}
	}

	// -- FOLLOW UP --
	if (donor.followUps && donor.followUps.length > 0) {
		for (const followUp of donor.followUps) {
			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterFollowUpId: followUp.clinicalInfo.submitter_follow_up_id as string,
				submitterDonorId,
				entityType: ClinicalEntitySchemaNames.FOLLOW_UP,
			});
			followUp.followUpId = id;
		}
	}

	// -- EXPOSURE --
	if (donor.exposure && donor.exposure.length > 0) {
		for (const exposure of donor.exposure) {
			const id = await getId({
				...request,
				programId: donor.programId as string,
				submitterDonorId,
				entityType: ClinicalEntitySchemaNames.EXPOSURE,
			});
			exposure.exposureId = id;
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
		try {
			const url = config.getConfig().tokenUrl();
			const response = await axios.post(config.getConfig().tokenUrl(), data, headers);
			return response.data.access_token;
		} catch (e) {
			throw new Errors.NetworkError('Error fetching ego token. Caused by: ' + e);
		}
	},
	{
		maxAge: ms('1d'),
		preFetch: true,
	},
);
