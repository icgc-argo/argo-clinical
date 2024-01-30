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

import * as dictionaryManager from '../../dictionary/manager';
import { Donor } from '../../clinical/clinical-entities';

import { loggerFor } from '../../logger';
import { cloneDeep } from 'lodash';
import { SchemasDictionary } from '@overturebio-stack/lectern-client/lib/schema-entities';
const L = loggerFor(__filename);

/**
 * Validate an array of Donors with the current dictionary.
 * An array of donors will be returned with updated validation information
 * including what dictionary version they are valid for and when the validation occurred.
 *
 * @param donors
 * @returns
 */
export const validateDonorsWithCurrentDictionary = async (donors: Donor[]): Promise<Donor[]> => {
	// check donor if was invalid against current dictionary
	const currentDictionary = await dictionaryManager.instance().getCurrent();

	const updatedDonors = donors.map(validateDonorForDictionary(currentDictionary));
	return updatedDonors;
};

/**
 * Provided a dictionary instance, this returns a validation function that can validate a Donor for
 * the schemas in that dictionary. The validation function will return a cloned donor with updated validation information
 * including what dictionary version it is valid for and when the validation occurred.
 *
 * Note: This marks the donor document with the version of the dictionary it was most recently validated with,
 * not the highest semantic version dictionary it passed validation with.
 * @param dictionary
 * @returns
 */
export const validateDonorForDictionary = (dictionary: SchemasDictionary) => (
	donor: Donor,
): Donor => {
	const updatedDonor = cloneDeep(donor);
	if (donor.schemaMetadata.isValid === false) {
		L.debug('Donor is invalid, revalidating if valid now');
		const isValid = dictionaryManager.revalidateAllDonorClinicalEntitiesAgainstSchema(
			updatedDonor,
			dictionary,
		);

		if (isValid) {
			L.info(`donor ${updatedDonor._id} is now valid`);
			updatedDonor.schemaMetadata.isValid = true;
			updatedDonor.schemaMetadata.lastValidSchemaVersion = dictionary.version;
		}
	}
	return updatedDonor;
};
