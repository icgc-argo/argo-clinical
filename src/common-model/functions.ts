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
import { filter, find, isEmpty } from 'lodash';
import {
	Biomarker,
	ClinicalEntity,
	ClinicalInfo,
	Comorbidity,
	dnaSampleTypes,
	Donor,
	Exposure,
	FamilyHistory,
	FollowUp,
	PrimaryDiagnosis,
	Specimen,
	SpecimenCoreCompletion,
	Therapy,
	Treatment,
} from '../clinical/clinical-entities';
import { notEmpty, convertToArray } from '../utils';
import {
	ClinicalEntitySchemaNames,
	ClinicalUniqueIdentifier,
	ClinicalTherapySchemaNames,
	EntityAlias,
} from './entities';

export function getSingleClinicalObjectFromDonor(
	donor: DeepReadonly<Donor>,
	clinicalEntitySchemaName: ClinicalEntitySchemaNames,
	constraints: object, // similar to mongo filters, e.g. {submitted_donor_id: 'DR_01'}
) {
	const entities = getClinicalObjectsFromDonor(donor, clinicalEntitySchemaName);
	return find(entities, constraints);
}

export function findClinicalObjects(
	donor: DeepReadonly<Donor>,
	clinicalEntitySchemaName: ClinicalEntitySchemaNames,
	constraints: object,
) {
	const entities = getClinicalObjectsFromDonor(donor, clinicalEntitySchemaName);
	return filter(entities, constraints);
}

type ClinicalRecords =
	| DeepReadonly<Donor>
	| DeepReadonly<Specimen>
	| DeepReadonly<PrimaryDiagnosis>
	| DeepReadonly<FamilyHistory>
	| DeepReadonly<Treatment>
	| DeepReadonly<FollowUp>
	| DeepReadonly<Exposure>
	| DeepReadonly<Biomarker>
	| DeepReadonly<Comorbidity>
	| DeepReadonly<Therapy>;

export function getClinicalObjectsFromDonor(
	donor: DeepReadonly<Donor>,
	clinicalEntitySchemaName: ClinicalEntitySchemaNames,
): readonly ClinicalRecords[] {
	if (clinicalEntitySchemaName == ClinicalEntitySchemaNames.DONOR) {
		return [donor];
	}

	if (clinicalEntitySchemaName == ClinicalEntitySchemaNames.SPECIMEN) {
		return donor.specimens;
	}

	if (clinicalEntitySchemaName == ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS) {
		if (donor.primaryDiagnoses) {
			return donor.primaryDiagnoses;
		}
	}

	if (clinicalEntitySchemaName == ClinicalEntitySchemaNames.FAMILY_HISTORY) {
		if (donor.familyHistory) {
			return donor.familyHistory;
		}
	}

	if (clinicalEntitySchemaName === ClinicalEntitySchemaNames.TREATMENT) {
		if (donor.treatments) {
			return donor.treatments;
		}
	}

	if (clinicalEntitySchemaName === ClinicalEntitySchemaNames.FOLLOW_UP) {
		if (donor.followUps) {
			return donor.followUps;
		}
	}

	if (clinicalEntitySchemaName === ClinicalEntitySchemaNames.EXPOSURE) {
		if (donor.exposure) {
			return donor.exposure;
		}
	}

	if (clinicalEntitySchemaName === ClinicalEntitySchemaNames.BIOMARKER) {
		if (donor.biomarker) {
			return donor.biomarker;
		}
	}

	if (clinicalEntitySchemaName === ClinicalEntitySchemaNames.COMORBIDITY) {
		if (donor.comorbidity) {
			return donor.comorbidity;
		}
	}

	if (ClinicalTherapySchemaNames.find((tsn) => tsn === clinicalEntitySchemaName)) {
		if (donor.treatments) {
			return donor.treatments
				.map((tr) => tr.therapies.filter((th) => th.therapyType === clinicalEntitySchemaName))
				.flat()
				.filter(notEmpty);
		}
	}

	return [];
}

export function getClinicalEntitiesFromDonorBySchemaName(
	donor: DeepReadonly<Donor>,
	clinicalEntitySchemaName: ClinicalEntitySchemaNames,
): ClinicalInfo[] {
	const result = getClinicalObjectsFromDonor(donor, clinicalEntitySchemaName);
	const clinicalRecords = result
		.map((entityRecord) => {
			if (entityRecord?.clinicalInfo) {
				return entityRecord.clinicalInfo as ClinicalInfo;
			}
		})
		.filter(notEmpty);

	return clinicalRecords;
}

export function getClinicalEntitySubmittedData(
	donor: DeepReadonly<Donor>,
	clinicalEntitySchemaName: ClinicalEntitySchemaNames,
): ClinicalInfo[] {
	const donor_id = donor.donorId;
	const program_id = donor.programId;
	const baseRecord: ClinicalInfo = { donor_id, program_id };
	const result = getClinicalObjectsFromDonor(donor, clinicalEntitySchemaName) as any[];
	let clinicalRecords = [];

	switch (clinicalEntitySchemaName) {
		case ClinicalEntitySchemaNames.DONOR:
			clinicalRecords = result.map((entity: Donor) => ({
				...baseRecord,
				updatedAt: donor.updatedAt,
				...entity.clinicalInfo,
			}));
			break;
		case ClinicalEntitySchemaNames.TREATMENT:
			clinicalRecords = result.map((treatment: Treatment) => {
				const clinicalInfo = treatment.clinicalInfo || {};
				return {
					...baseRecord,
					treatment_id: treatment.treatmentId,
					...clinicalInfo,
				};
			});
			break;
		case ClinicalEntitySchemaNames.REGISTRATION:
			clinicalRecords = getSampleRegistrationDataFromDonor(donor);
			break;
		case ClinicalEntitySchemaNames.SPECIMEN:
			clinicalRecords = result.map((specimen) => {
				const { tumourNormalDesignation: tumour_normal_designation } = specimen;
				return {
					...baseRecord,
					tumour_normal_designation,
					...specimen.clinicalInfo,
				};
			});
			break;
		default:
			clinicalRecords = result.map((entity: ClinicalEntity) => ({
				...baseRecord,
				submitter_id: donor.submitterId,
				...entity.clinicalInfo,
			}));
	}

	return clinicalRecords;
}

export function getSampleRegistrationDataFromDonor(donor: DeepReadonly<Donor>) {
	const baseRegistrationRecord = {
		donor_id: donor.donorId,
		program_id: donor.programId,
		submitter_donor_id: donor.submitterId,
		gender: donor.gender,
	};

	const { specimens } = donor;

	const sample_registration = specimens
		.map((sp) =>
			sp.samples.map((sm) => ({
				...baseRegistrationRecord,
				submitter_specimen_id: sp.submitterId,
				specimen_tissue_source: sp.specimenTissueSource,
				tumour_normal_designation: sp.tumourNormalDesignation,
				specimen_type: sp.specimenType,
				submitter_sample_id: sm.submitterId,
				sample_type: sm.sampleType,
			})),
		)
		.flat();

	return sample_registration;
}

/**
 * Identifies the specimens with DNA Samples. Returns true when the specimen has at least
 * one sample with a sample type included in the `dnaSampleTypes`
 *
 * @example
 * ```ts
 * const specimensWithDnaSamples = donor.specimens.filter(filterHasDnaSample);
 * ```
 * @param specimen
 * @returns
 */
export const filterHasDnaSample = (specimen: Specimen | DeepReadonly<Specimen>): boolean =>
	// All Specimen Have a Sample Registration
	// Only DNA records count towards completion
	specimen.samples.some((sample) => dnaSampleTypes.includes(sample.sampleType));

export const filterTumourNormalRecords = (recordArray: Specimen[], type: string) =>
	recordArray.filter((specimen) => specimen.tumourNormalDesignation === type);

export const calculateSpecimenCompletionStats = (
	donorSpecimenData: Specimen[],
	hasSingleSpecimenException: boolean,
): SpecimenCoreCompletion => {
	const normalRegisteredSamples = filterTumourNormalRecords(donorSpecimenData, 'Normal');
	const tumourRegisteredSamples = filterTumourNormalRecords(donorSpecimenData, 'Tumour');

	const normalSubmittedRecords = normalRegisteredSamples.filter(
		(specimen) => !isEmpty(specimen.clinicalInfo),
	);
	const tumourSubmittedRecords = tumourRegisteredSamples.filter(
		(specimen) => !isEmpty(specimen.clinicalInfo),
	);

	const normalRegistrations = normalRegisteredSamples.length;
	const tumourRegistrations = tumourRegisteredSamples.length;
	const normalSubmissions = normalSubmittedRecords.length;
	const tumourSubmissions = tumourSubmittedRecords.length;

	/**
	 * if there is an exception:
	 * - sets normalSpecimensPercentage to 1
	 * - UI reads core complete as having errors if set to 0
	 * - normalRegistrations and normalSubmissions are 0
	 *
	 */
	const normalSpecimensPercentage = hasSingleSpecimenException
		? 1
		: normalRegistrations === 0 || normalSubmissions === 0
		? 0
		: normalSubmissions / normalRegistrations;

	const tumourSpecimensPercentage =
		tumourRegistrations === 0 || tumourSubmissions === 0
			? 0
			: tumourSubmissions / tumourRegistrations;

	const coreCompletionPercentage = hasSingleSpecimenException
		? tumourSpecimensPercentage
		: (normalSpecimensPercentage + tumourSpecimensPercentage) / 2;

	const completionValues = {
		coreCompletionPercentage,
		normalSpecimensPercentage,
		tumourSpecimensPercentage,
		normalRegistrations,
		tumourRegistrations,
		normalSubmissions,
		tumourSubmissions,
	};

	return completionValues;
};

export const donorCompletionFields: Array<keyof Donor> = [
	'completionStats',
	'specimens',
	'followUps',
	'treatments',
	'primaryDiagnoses',
];

type ClinicalEntityDataFields = EntityAlias | ClinicalEntitySchemaNames | keyof Donor;

export const getRequiredDonorFieldsForEntityTypes = (
	entityTypes: Array<string | EntityAlias>,
): Array<ClinicalEntityDataFields> => {
	let requiredFields: Array<ClinicalEntityDataFields> = [];

	if (
		// Donor Completion Stats require core entity data
		entityTypes.includes('donor')
	) {
		requiredFields = [...requiredFields, ...donorCompletionFields];
	}

	if (
		// Sample Registration requires Specimen data
		entityTypes.includes('sampleRegistration') &&
		!requiredFields.includes('specimens')
	) {
		requiredFields = [...requiredFields, 'specimens'];
	}
	if (
		// Clinical Therapies require Treatments
		// hormoneTherapy + treatment do not match schema names
		entityTypes.includes('hormoneTherapy') ||
		entityTypes.includes('treatment') ||
		(ClinicalTherapySchemaNames.some((entity) => entityTypes.includes(entity)) &&
			!requiredFields.includes('treatments'))
	) {
		requiredFields = [...requiredFields, 'treatments'];
	}

	// Return w/ duplicate fields filtered out
	const donorFields = requiredFields.filter(filterDuplicates);

	return donorFields;
};

export function getSingleClinicalEntityFromDonorBySchemaName(
	donor: DeepReadonly<Donor>,
	clinicalEntityType: ClinicalEntitySchemaNames,
	clinicalInfoRef: ClinicalInfo, // this function will use the values of the clinicalInfoRef that are needed to uniquely find a clinical info
): ClinicalInfo | undefined {
	if (clinicalEntityType === ClinicalEntitySchemaNames.REGISTRATION) {
		throw new Error('Sample_registration has no clincal info to return');
	}
	const uniqueIdNames: string[] = convertToArray(ClinicalUniqueIdentifier[clinicalEntityType]);
	if (isEmpty(uniqueIdNames)) {
		throw new Error("Illegal state, couldn't find entity id field name");
	}
	const constraints: ClinicalInfo = {};
	uniqueIdNames.forEach((idN) => (constraints[idN] = clinicalInfoRef[idN]));

	const clinicalInfos = getClinicalEntitiesFromDonorBySchemaName(donor, clinicalEntityType);
	return find(clinicalInfos, constraints);
}

export function getEntitySubmitterIdFieldName(entityName: ClinicalEntitySchemaNames) {
	return `submitter_${entityName}_id` as string;
}

export function filterDuplicates<DataType>(record: DataType, index: number, array: DataType[]) {
	return array.indexOf(record) === index;
}
