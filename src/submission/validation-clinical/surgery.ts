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
import { isEqual, omit } from 'lodash';
import _ from 'mongoose-sequence';
import { Donor, Therapy } from '../../clinical/clinical-entities';
import {
	ClinicalEntitySchemaNames,
	CommonTherapyFieldsEnum,
	DonorFieldsEnum,
	SurgeryFieldsEnum,
} from '../../common-model/entities';
import {
	findClinicalObjects,
	getSingleClinicalObjectFromDonor,
} from '../../common-model/functions';
import {
	DataValidationErrors,
	SubmissionValidationError,
	SubmissionValidationOutput,
	SubmittedClinicalRecord,
} from '../submission-entities';
import { checkTreatmentHasCorrectTypeForTherapy, getTreatment } from './therapy';
import * as utils from './utils';

export const validate = async (
	therapyRecord: DeepReadonly<SubmittedClinicalRecord>,
	existentDonor: DeepReadonly<Donor>,
	mergedDonor: Donor,
): Promise<SubmissionValidationOutput> => {
	if (!therapyRecord || !mergedDonor || !existentDonor) {
		throw new Error("Can't call this function without a registerd donor & therapy record");
	}
	const errors: SubmissionValidationError[] = [];

	const treatment = getTreatment(therapyRecord, mergedDonor, errors);
	if (!treatment) return { errors };
	checkTreatmentHasCorrectTypeForTherapy(therapyRecord, treatment, errors);

	// sub_sp_id is submitted in tsv?
	if (therapyRecord[SurgeryFieldsEnum.submitter_specimen_id]) {
		// 1. check if submitter_specimen_id has been registered with current donor
		const specimen = utils.getSpecimenFromDonor(existentDonor, therapyRecord, errors);
		if (!specimen) {
			return { errors };
		}

		// 2. check if there is more than one surgery by submitter_specimen_id in the current submission
		const specimenId = therapyRecord[SurgeryFieldsEnum.submitter_specimen_id];
		const surgeries = findClinicalObjects(mergedDonor, ClinicalEntitySchemaNames.SURGERY, {
			clinicalInfo: {
				[SurgeryFieldsEnum.submitter_specimen_id]: specimenId as string,
			},
		}) as DeepReadonly<Therapy>[];

		// 3. check if there is existing surgery in DB by submitter_specimen_id
		const existingSurgeryInDB = getSingleClinicalObjectFromDonor(
			existentDonor,
			ClinicalEntitySchemaNames.SURGERY,
			{
				clinicalInfo: {
					[SurgeryFieldsEnum.submitter_specimen_id]: specimenId as string,
				},
			},
		) as DeepReadonly<Therapy>;

		if (existingSurgeryInDB || surgeries.length > 1) {
			const duplicationError = checkSurgeryDuplicateOrUpdate(
				therapyRecord,
				surgeries,
				existingSurgeryInDB,
			);
			if (duplicationError) {
				errors.push(duplicationError);
			}
		} else {
			const surgeryNotEqualError = validateSurgeryByDonorAndTreatment(
				therapyRecord,
				existentDonor,
				mergedDonor,
			);
			if (surgeryNotEqualError) {
				errors.push(surgeryNotEqualError);
			}
		}
	} else {
		// when submitter_specimen_id is not submitted in tsv, and if surgery with the same combo of submitter_treatment_id
		// and submitter_donor_id have been submitted before, should invalidate.
		const surgeryInDB = findSubmittedSurgeryByDonorAndTreatment(existentDonor, therapyRecord);
		const surgeriesInCurrentSubmission = findSurgeryInCurrentSubmission(mergedDonor, therapyRecord);
		if (surgeryInDB || surgeriesInCurrentSubmission.length > 1) {
			errors.push(
				utils.buildSubmissionError(
					therapyRecord,
					DataValidationErrors.DUPLICATE_SURGERY_WHEN_SPECIMEN_NOT_SUBMITTED,
					DonorFieldsEnum.submitter_donor_id,
					{
						submitter_donor_id: therapyRecord[CommonTherapyFieldsEnum.submitter_donor_id],
						submitter_treatment_id: therapyRecord[CommonTherapyFieldsEnum.submitter_treatment_id],
					},
				),
			);
		}
	}

	return { errors };
};

// verify if there is surgery with the current combination of submitter_donor_id and submitter_treatment_id
// in DB, or if there are more than one surgeries with the current submitter_donor_id and submitter_treatment_id
// in current submission, if found any, then validate if the found surgery's surgery_type is the
// same as the current surgery being validated.
function validateSurgeryByDonorAndTreatment(
	therapyRecord: DeepReadonly<SubmittedClinicalRecord>,
	existentDonor: DeepReadonly<Donor>,
	mergedDonor: Donor,
) {
	const surgeryInDB = findSubmittedSurgeryByDonorAndTreatment(existentDonor, therapyRecord);
	const surgeriesInCurrentSubmission = findSurgeryInCurrentSubmission(mergedDonor, therapyRecord);

	if (surgeryInDB || surgeriesInCurrentSubmission.length > 1) {
		const isSurgeryTypeEqual = checkSurgeryTypeEquality(
			therapyRecord,
			surgeryInDB,
			surgeriesInCurrentSubmission,
		);
		if (!isSurgeryTypeEqual) {
			return utils.buildSubmissionError(
				therapyRecord,
				DataValidationErrors.SURGERY_TYPES_NOT_EQUAL,
				SurgeryFieldsEnum.submitter_specimen_id,
				{
					submitter_donor_id: therapyRecord[CommonTherapyFieldsEnum.submitter_donor_id],
					submitter_treatment_id: therapyRecord[CommonTherapyFieldsEnum.submitter_treatment_id],
					surgery_type: therapyRecord[SurgeryFieldsEnum.surgery_type],
				},
			);
		}
	}
}

function findSubmittedSurgeryByDonorAndTreatment(
	existenDonor: DeepReadonly<Donor>,
	therapyRecord: DeepReadonly<SubmittedClinicalRecord>,
) {
	const submitterDonorId = therapyRecord[CommonTherapyFieldsEnum.submitter_donor_id];
	const sumitterTreatmentId = therapyRecord[CommonTherapyFieldsEnum.submitter_treatment_id];
	return getSingleClinicalObjectFromDonor(existenDonor, ClinicalEntitySchemaNames.SURGERY, {
		clinicalInfo: {
			[CommonTherapyFieldsEnum.submitter_donor_id]: submitterDonorId as string,
			[CommonTherapyFieldsEnum.submitter_treatment_id]: sumitterTreatmentId as string,
		},
	}) as DeepReadonly<Therapy>;
}

function findSurgeryInCurrentSubmission(
	mergedDonor: Donor,
	therapyRecord: DeepReadonly<SubmittedClinicalRecord>,
) {
	const submitterDonorId = therapyRecord[CommonTherapyFieldsEnum.submitter_donor_id];
	const sumitterTreatmentId = therapyRecord[CommonTherapyFieldsEnum.submitter_treatment_id];
	const sugeries = findClinicalObjects(mergedDonor, ClinicalEntitySchemaNames.SURGERY, {
		clinicalInfo: {
			[CommonTherapyFieldsEnum.submitter_donor_id]: submitterDonorId as string,
			[CommonTherapyFieldsEnum.submitter_treatment_id]: sumitterTreatmentId as string,
		},
	}) as DeepReadonly<Therapy>[];

	return sugeries;
}

function checkSurgeryTypeEquality(
	therapyRecord: DeepReadonly<SubmittedClinicalRecord>,
	surgeryInDB: DeepReadonly<Therapy> | undefined,
	surgeriesInCurrentSubmission: DeepReadonly<Therapy>[],
) {
	const therapyRecordSurgeryType = therapyRecord[SurgeryFieldsEnum.surgery_type] as string;

	const existingSurgeryType = surgeryInDB
		? (surgeryInDB.clinicalInfo[SurgeryFieldsEnum.surgery_type] as string)
		: (surgeriesInCurrentSubmission[0].clinicalInfo[SurgeryFieldsEnum.surgery_type] as string);

	return existingSurgeryType === therapyRecordSurgeryType;
}

// Prevents submitting duplicate records; allows updating existing records with new values
function checkSurgeryDuplicateOrUpdate(
	therapyRecord: DeepReadonly<SubmittedClinicalRecord>,
	prevSurgeries: DeepReadonly<Therapy>[],
	existingSurgery: DeepReadonly<Therapy> | undefined,
) {
	// Clone Submitted Record, minus index key, which is not stored on Clinical Records
	const submissionClone = omit(therapyRecord, 'index');

	// Determine if Submission is duplicating existing record, or if Submission is an update
	// Sort insures [A,B,C] is not compared with [A,C,B]
	const submissionValues = Object.values(submissionClone).sort();
	const existingRecordValues = existingSurgery
		? Object.values(existingSurgery.clinicalInfo).sort()
		: [];
	const submissionIsDuplicate =
		submissionValues.length === existingRecordValues.length &&
		isEqual(submissionValues, existingRecordValues);

	if (submissionIsDuplicate || prevSurgeries.length > 1) {
		// If there is duplicate surgery with the current submitter_specimen_id submitted before,
		// or if there are more than one surgeries with the same submitter_specimen_id
		// in the current submission, then invalid.
		return utils.buildSubmissionError(
			therapyRecord,
			DataValidationErrors.DUPLICATE_SUBMITTER_SPECIMEN_ID_IN_SURGERY,
			DonorFieldsEnum.submitter_donor_id,
			{
				submitter_specimen_id: therapyRecord[SurgeryFieldsEnum.submitter_specimen_id],
			},
		);
	}
}
