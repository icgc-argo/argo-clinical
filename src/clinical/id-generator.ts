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

const token =
	'eyJhbGciOiJSUzI1NiJ9.eyJpYXQiOjE3MTI2MjA0OTksImV4cCI6MTcxMjYzMTI5OSwic3ViIjoiZmU1MzVjNTAtOGNkYy00MmI4LTk4ZTctNzVjZWRjMDQwMDhmIiwiaXNzIjoiZWdvIiwianRpIjoiN2ZmMjY2NTYtZmQ1Ny00YzgxLWE5MTctZTJjNzc4NzczZWZhIiwiY29udGV4dCI6eyJzY29wZSI6WyJGSUxFU0VSVklDRS5XUklURSIsIkNMSU5JQ0FMU0VSVklDRS5SRUFEIiwiRklMRVNFUlZJQ0UuUkVBRCIsIlJEUEMtQ0EuUkVBRCIsIlBST0dSQU1TRVJWSUNFLlJFQUQiLCJSRFBDLWNvbGxhYi5SRUFEIiwiREMtUkVHSVNUUlkuV1JJVEUiLCJEQUNPLVJFVklFVy5SRUFEIiwiRElDVElPTkFSWS5XUklURSIsInNjb3JlLlJFQUQiLCJEQy1SRUdJU1RSWS5SRUFEIiwic29uZy5XUklURSIsInJvYi5SRUFEIiwiUFJPR1JBTURBVEEtRlVMTC1DQS5SRUFEIiwiRElDVElPTkFSWS5SRUFEIiwiREFDTy5SRUFEIiwiUkRQQy1DQS5XUklURSIsIlBST0dSQU1TRVJWSUNFLldSSVRFIiwiREFDTy1SRVZJRVcuV1JJVEUiLCJSRFBDLWNvbGxhYi5XUklURSIsInNvbmcuUkVBRCIsIlBST0dSQU1EQVRBLUZVTEwtQ0EuV1JJVEUiLCJDTElOSUNBTFNFUlZJQ0UuV1JJVEUiLCJQUk9HUkFNLUZVTEwtQ0EuUkVBRCIsInNjb3JlLldSSVRFIiwicm9iLldSSVRFIiwiUFJPR1JBTS1GVUxMLUNBLldSSVRFIiwiUFJPR1JBTU1FTUJFUlNISVAtRlVMTC5SRUFEIl0sInVzZXIiOnsiZW1haWwiOiJ1cmFuZ3dhbGFAb2ljci5vbi5jYSIsInN0YXR1cyI6IkFQUFJPVkVEIiwiZmlyc3ROYW1lIjoiVW1tdWxraXJhbSIsImxhc3ROYW1lIjoiUmFuZ3dhbGEiLCJjcmVhdGVkQXQiOjE2NTgxNzgxMjk2NzksImxhc3RMb2dpbiI6MTcxMjYyMDQ5OTM0OSwicHJlZmVycmVkTGFuZ3VhZ2UiOm51bGwsInByb3ZpZGVyVHlwZSI6IkdPT0dMRSIsInByb3ZpZGVyU3ViamVjdElkIjoiMTA2MTExNDQyNTcxNDcxODEwNDgyIiwidHlwZSI6IkFETUlOIiwiZ3JvdXBzIjpbIjcxOGU5ZWM1LTBkMjgtNGUyYS05ODMxLTQ2NDI4MGMzZjVjNiIsImUyNDRkMjM4LTU3MjktNDYzMy05MzI2LTY3MTFhYmYwYzM3YyIsImIwNDcxMzc4LTRmMWMtNDVlZi05NzViLTU1MjEwNjdmNjUyNCIsImI3NGJhYTNiLTcyNGMtNDdkMi1hMTllLWRjNGEyNTc4OTgyYyIsImNkMzhjNDU2LTBkY2ItNDAwMS05ZDM1LWU4ODRhYWI0Nzk0ZiIsIjBhNDMwMzFiLWJiOWYtNGQzNy05ZGNkLTZkNDdiZTc0YTY5MyJdfX0sImF1ZCI6W119.K1Le0AOYn2Gpvmp2saumUej1qh-7pYCLjB6N5g4PToofT6nlGXFT7CpkX8__N_sz_KY6NhqU472KCNw7ksV5yp7E1mQW5CC-8TrJWqLjLqctVzUSxNaou96JXozef65ISR-Izo8HKVlS2k1GcUHR-D51SLBckFSfXgnAJSp9mRBIXo_N0FR4KqcyV3McGIYS0yNp0PKFNHL2aBv3Lq6zgHafMrry5uoA3zuBcC84O10Kwq7hXT-KGf7oOBwLBVgLR38F6K_STbvAVrjunUWBnqiAOajz6RMBk5Z9Xl4P5r8EUVrZd70FJFcCI4Bpwro2G7RO2QWhZGOfyQiFZ1nOug';

export interface PartialDonor {
	_id?: string;
	__v?: number; // mongodb property not being filtered out
	createBy?: string;
	schemaMetadata?: SchemaMetadata | undefined;
	donorId?: number;
	gender?: string;
	submitterId?: string;
	programId?: string;
	specimens?: Array<Specimen>;
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

export async function getId(
	programId: string,
	submitterId: string,
	family_relative_id: string,
	entityType: string,
) {
	console.log('getId function called');
	const headers = {
		headers: {
			Authorization: 'Bearer ' + token,
		},
	};

	const response = await axios.get(
		// 'http://localhost:9001/' + programId + '/' + submitterId + '/' + family_relative_id + '/' + entityType,
		`http://localhost:9001/${programId}/${submitterId}/${family_relative_id}/${entityType}`,
		headers,
	);
	console.log('getId response: ' + response.data.entityId + ' - ' + response.data.entityType);
	return parseInt(response.data.entityId);
}

export async function setEntityIds(donor: PartialDonor) {
	const programId = donor.programId as string;

	// -- DONOR --
	const donorId = await getId(
		programId,
		donor.submitterId as string,
		'null',
		ClinicalEntitySchemaNames.DONOR,
	);
	donor.donorId = donorId;
	console.log(donor.donorId);

	// -- SPECIMEN --
	if (donor.specimens && donor.specimens.length > 0) {
		for (const specimen of donor.specimens) {
			console.log(
				'specimen.clinicalInfo.submitter_specimen_id: ' +
					specimen.clinicalInfo.submitter_specimen_id,
			);
			console.log('specimen.submitterId: ' + specimen.submitterId);
			const submitterId = !specimen.clinicalInfo.submitter_specimen_id
				? specimen.submitterId
				: specimen.clinicalInfo.submitter_specimen_id;
			const id = await getId(
				programId,
				// specimen.clinicalInfo.submitter_specimen_id as string,
				submitterId as string,
				'null',
				ClinicalEntitySchemaNames.SPECIMEN,
			);
			specimen.specimenId = id;
			console.log(specimen.specimenId);

			// -- SAMPLE --
			const samples = specimen.samples;
			for (const sample of samples) {
				const id = await getId(
					programId,
					sample.submitterId as string,
					'null',
					ClinicalEntitySchemaNames.REGISTRATION,
				);
				sample.sampleId = id;
				console.log(sample.sampleId);
			}
		}
	}

	// -- BIOMARKER --
	// submitter_specimen_id
	if (donor.biomarker && donor.biomarker.length > 0) {
		for (const bm of donor.biomarker) {
			const id = await getId(
				programId,
				bm.clinicalInfo.submitter_specimen_id as string,
				'null',
				ClinicalEntitySchemaNames.BIOMARKER,
			);
			bm.biomarkerId = id;
			console.log(bm.biomarkerId);
		}
	}

	// -- COMORBIDITY --
	// submitter_donor_id and comorbidity_type_code - UK-confirm
	if (donor.comorbidity && donor.comorbidity.length > 0) {
		for (const c of donor.comorbidity) {
			const cRec = c.clinicalInfo.submitter_donor_id + '-' + c.clinicalInfo.comorbidity_type_code;
			const id = await getId(
				programId,
				// c.clinicalInfo.submitter_donor_id as string,
				cRec as string,
				'null',
				ClinicalEntitySchemaNames.COMORBIDITY,
			);
			c.comorbidityId = id;
			console.log(c.comorbidityId);
		}
	}

	// -- PRIMARY DIAGNOSIS --
	if (donor.primaryDiagnoses && donor.primaryDiagnoses.length > 0) {
		for (const p of donor.primaryDiagnoses) {
			const id = await getId(
				programId,
				p.clinicalInfo.submitter_primary_diagnosis_id as string,
				'null',
				ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
			);
			p.primaryDiagnosisId = id;
			console.log(p.primaryDiagnosisId);
		}

		/*const updatePrimaryDiagnosesIds = donor.primaryDiagnoses.map(p => {
      console.log('submitter_primary_diagnosis_id: ' + p.clinicalInfo.submitter_primary_diagnosis_id);
      getId(programId, p.clinicalInfo.submitter_primary_diagnosis_id as string, 'primary_diagnosis')
        .then(id => p.primaryDiagnosisId = id)
        .catch((err) => {
          console.log(err);
        });
    });*/

		// await Promise.all(updatePrimaryDiagnosesIds);
	}

	// -- TREATMENT --
	if (donor.treatments && donor.treatments.length > 0) {
		for (const t of donor.treatments) {
			const id = await getId(
				programId,
				t.clinicalInfo.submitter_treatment_id as string,
				'null',
				ClinicalEntitySchemaNames.TREATMENT,
			);
			t.treatmentId = id;
			console.log(t.treatmentId);
		}
	}

	// -- FAMILY HISTORY --
	// submitter_donor_id and family_relative_id - UK: confirm
	if (donor.familyHistory && donor.familyHistory.length > 0) {
		for (const fh of donor.familyHistory) {
			const fhRec = fh.clinicalInfo.submitter_donor_id + '_' + fh.clinicalInfo.family_relative_id;
			const id = await getId(
				programId,
				fh.clinicalInfo.submitter_donor_id as string,
				fh.clinicalInfo.family_relative_id as string,
				// fhRec as string,
				ClinicalEntitySchemaNames.FAMILY_HISTORY,
			);
			fh.familyHistoryId = id;
			console.log(fh.familyHistoryId);
		}
	}

	// -- FOLLOW UP --
	if (donor.followUps && donor.followUps.length > 0) {
		for (const fl of donor.followUps) {
			const id = await getId(
				programId,
				fl.clinicalInfo.submitter_follow_up_id as string,
				'null',
				ClinicalEntitySchemaNames.FOLLOW_UP,
			);
			fl.followUpId = id;
			console.log(fl.followUpId);
		}
	}

	// -- EXPOSURE --
	// submitter_donor_id
	if (donor.exposure && donor.exposure.length > 0) {
		for (const ex of donor.exposure) {
			const id = await getId(
				programId,
				ex.clinicalInfo.submitter_donor_id as string,
				'null',
				ClinicalEntitySchemaNames.EXPOSURE,
			);
			ex.exposureId = id;
			console.log(ex.exposureId);
		}
	}

	return donor;
}

// UK: idgen
