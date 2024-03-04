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
import { getPaginatedClinicalData, ClinicalDataVariables } from '../../clinical/clinical-service';
import { ClinicalEntityData, ClinicalInfo } from '../../clinical/clinical-entities';
import { completionFilters } from '../../clinical/api/clinical-api';
import { ClinicalErrorsResponseRecord } from '../../common-model/entities';
import { retrieveClinicalDataErrors } from './clinicalErrors';

export type ClinicalEntityGQLData = {
	programShortName: string;
	clinicalEntities: ClinicalEntityDisplayData[];
};

// FE Clinical Data Query Response Payload
export type ClinicalEntityDataResponse = ClinicalEntityGQLData & {
	clinicalErrors?: ClinicalErrorsResponseRecord[];
};

// GQL Formatting
type EntityDisplayRecord = {
	name: string;
	value: string | number | boolean | string[] | number[] | boolean[] | undefined;
};

interface ClinicalEntityDisplayData extends Omit<ClinicalEntityData, 'records'> {
	records: EntityDisplayRecord[][];
}

const convertClinicalDataToGql = (
	programShortName: string,
	clinicalEntities: ClinicalEntityData[],
) => {
	const clinicalDisplayData: ClinicalEntityDisplayData[] = clinicalEntities.map(
		(entity: ClinicalEntityData) => {
			const records: EntityDisplayRecord[][] = [];

			entity.records.forEach((record: ClinicalInfo) => {
				const displayRecords: EntityDisplayRecord[] = [];
				for (const [name, val] of Object.entries(record)) {
					// omit the submitter_id property from the clinical data table
					if (name === 'submitter_id') continue;
					const value = Array.isArray(val) ? val.join(', ') : val;
					displayRecords.push({ name, value });
				}
				records.push(displayRecords);
			});

			const entityData: ClinicalEntityDisplayData = {
				...entity,
				records,
			};

			return entityData;
		},
	);

	const clinicalData = {
		programShortName,
		clinicalEntities: clinicalDisplayData,
	};

	return clinicalData;
};

const clinicalDataResolver = async (obj: unknown, args: ClinicalDataVariables) => {
	const { programShortName, filters } = args;
	const { completionState: state = 'all', sort = 'donorId' } = filters;
	const completionState = completionFilters[state];

	const query = { ...filters, sort, completionState, programShortName };

	const { clinicalEntities = [] } = await getPaginatedClinicalData(programShortName, query);

	const clinicalEntityData = convertClinicalDataToGql(programShortName, clinicalEntities);

	const { clinicalErrors } = await retrieveClinicalDataErrors(clinicalEntityData, {
		programShortName,
		donorIds: [],
	});

	const clinicalData: ClinicalEntityDataResponse = {
		...clinicalEntityData,
		clinicalErrors,
	};

	return clinicalData;
};

export default clinicalDataResolver;
