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

import { Donor } from '../../../../src/clinical/clinical-entities';
import { FollowupFieldsEnum, TreatmentFieldsEnum } from '../../../../src/common-model/entities';
import { MissingEntityException } from '../../../../src/exception/missing-entity-exceptions/model';
import {
	FollowUpExceptionRecord,
	ProgramException,
	SpecimenExceptionRecord,
	TreatmentExceptionRecord,
	EntityException,
} from '../../../../src/exception/property-exceptions/types';

export const TEST_PROGRAM_ID = 'TEST-IE';

export const existingDonor01: Donor = {
	schemaMetadata: {
		isValid: true,
		lastValidSchemaVersion: '1.0',
		originalSchemaVersion: '1.0',
	},
	_id: 'i8321321',
	submitterId: 'DO-0',
	programId: 'TEST_PROGRAM_ID',
	donorId: 0,
	clinicalInfo: {},
	gender: 'Female',
	specimens: [
		{
			submitterId: 'SP1',
			specimenTissueSource: 'XYZ',
			specimenId: 10,
			clinicalInfo: {
				submitter_specimen_id: 'SP-0',
			},
			tumourNormalDesignation: 'Normal',
			specimenType: 'Normal',
			samples: [
				{
					sampleType: 'ST1',
					submitterId: 'AM1',
				},
			],
		},
	],
};

export const existingDonor02: Donor = {
	schemaMetadata: {
		isValid: true,
		lastValidSchemaVersion: '1.0',
		originalSchemaVersion: '1.0',
	},
	_id: 'juadskasd23',
	submitterId: 'DO-2',
	programId: 'TEST_PROGRAM_ID',
	donorId: 2,
	clinicalInfo: {},
	gender: 'Female',
	specimens: [
		{
			submitterId: 'SP1',
			specimenTissueSource: 'XYZZ',
			clinicalInfo: {},
			tumourNormalDesignation: 'Normal',
			specimenType: 'Normal',
			samples: [
				{
					sampleType: 'ST11',
					submitterId: 'AM1',
				},
			],
		},
	],
	treatments: [
		{
			treatmentId: 20,
			clinicalInfo: {
				[TreatmentFieldsEnum.submitter_treatment_id]: 'T_02',
				treatment_start_interval: 'Unknown',
			},
			therapies: [],
		},
	],
};

export const existingDonor03: Donor = {
	schemaMetadata: {
		isValid: true,
		lastValidSchemaVersion: '1.0',
		originalSchemaVersion: '1.0',
	},
	_id: 'juadskasd122',
	submitterId: 'AB3',
	programId: 'TEST_PROGRAM_ID',
	donorId: 3,
	clinicalInfo: {},
	gender: 'Female',
	specimens: [
		{
			submitterId: 'SP12',
			specimenTissueSource: 'XYZZ',
			clinicalInfo: {},
			tumourNormalDesignation: 'Normal',
			specimenType: 'Normal',
			samples: [
				{
					sampleType: 'ST10',
					submitterId: 'AM1',
				},
			],
		},
	],
	followUps: [
		{
			followUpId: 30,
			clinicalInfo: {
				[FollowupFieldsEnum.submitter_follow_up_id]: 'FL-0',
				some_field: 1,
				interval_of_followUp: 'Unknown',
			},
		},
	],
};

export const existingDonor04: Donor = {
	schemaMetadata: {
		isValid: true,
		lastValidSchemaVersion: '1.0',
		originalSchemaVersion: '1.0',
	},
	_id: 'juadskasd122',
	submitterId: 'AB4',
	programId: 'TEST_PROGRAM_ID',
	donorId: 4,
	clinicalInfo: {},
	gender: 'Female',
	specimens: [
		{
			submitterId: 'SP12',
			specimenTissueSource: 'XYZZ',
			clinicalInfo: {},
			tumourNormalDesignation: 'Normal',
			specimenType: 'Normal',
			samples: [
				{
					sampleType: 'ST10',
					submitterId: 'AM1',
				},
			],
		},
	],
};

export const programExceptionStub: ProgramException = {
	programId: TEST_PROGRAM_ID,
	exceptions: [
		{
			program_name: TEST_PROGRAM_ID,
			schema: 'treatment',
			requested_core_field: 'treatment_start_interval',
			requested_exception_value: 'Unknown',
		},
	],
};

export const followupExceptionStub: FollowUpExceptionRecord = {
	program_name: TEST_PROGRAM_ID,
	requested_core_field: 'interval_of_followUp',
	schema: 'followUp',
	requested_exception_value: 'Not applicable',
	submitter_follow_up_id: 'FL-0',
	submitter_donor_id: 'AB3',
};

export const specimenExceptionStub: SpecimenExceptionRecord = {
	program_name: TEST_PROGRAM_ID,
	requested_core_field: 'specimen_acquisition_interval',
	schema: 'specimen',
	requested_exception_value: 'Not applicable',
	submitter_specimen_id: 'SP-0',
	submitter_donor_id: 'DO-0',
};

export const treatmentExceptionStub: TreatmentExceptionRecord = {
	program_name: TEST_PROGRAM_ID,
	schema: 'treatment',
	requested_core_field: 'treatment_start_interval',
	requested_exception_value: 'Unknown',
	submitter_treatment_id: 'T_02',
	submitter_donor_id: 'DO-2',
};

export const missingEntityStub: MissingEntityException = {
	programId: TEST_PROGRAM_ID,
	donorSubmitterIds: ['AB4'],
};

export const allEntitiesStub: EntityException = {
	programId: TEST_PROGRAM_ID,
	specimen: [specimenExceptionStub],
	follow_up: [followupExceptionStub],
	treatment: [treatmentExceptionStub],
};

export const emptyEntitiesStub: EntityException = {
	programId: TEST_PROGRAM_ID,
	specimen: [],
	follow_up: [],
	treatment: [],
};

export const emptyProgramExceptionStub: ProgramException = {
	programId: TEST_PROGRAM_ID,
	exceptions: [],
};

export const emptyMissingEntityStub: MissingEntityException = {
	programId: TEST_PROGRAM_ID,
	donorSubmitterIds: [],
};
