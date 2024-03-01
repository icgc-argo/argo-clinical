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

import { Donor } from '../../../src/clinical/clinical-entities';

export const existingDonor01: Donor = {
	schemaMetadata: {
		isValid: true,
		lastValidSchemaVersion: '1.0',
		originalSchemaVersion: '1.0',
	},
	_id: 'i8321321',
	submitterId: 'AB1',
	programId: 'TEST_PROGRAM_ID',
	donorId: 1,
	clinicalInfo: {},
	gender: 'Female',
	specimens: [
		{
			submitterId: 'SP1',
			specimenTissueSource: 'XYZ',
			clinicalInfo: {},
			tumourNormalDesignation: 'Normal',
			specimenType: 'Normal',
			samples: [
				{
					sampleType: 'ST1',
					submitterId: 'AM1',
				},
			],
		},
		{
			submitterId: 'SP13',
			specimenTissueSource: 'XYZ',
			clinicalInfo: {},
			tumourNormalDesignation: 'Normal',
			specimenType: 'Normal',
			samples: [],
		},
		{
			submitterId: 'SP14',
			specimenTissueSource: 'XYZ',
			clinicalInfo: {},
			tumourNormalDesignation: 'Normal',
			specimenType: 'Normal',
			samples: [],
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
	submitterId: 'AB2',
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
};
