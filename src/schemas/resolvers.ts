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

// Query
import clinicalData from './clinical-resolvers/clinicalData';
import clinicalErrors from './clinical-resolvers/clinicalErrors';
import clinicalRegistration from './clinical-resolvers/clinicalRegistrationData';
import clinicalSearchResults from './clinical-resolvers/clinicalSearchResults';
import clinicalSubmissions, {
	clinicalSubmissionTypesList,
	clinicalSubmissionSchemaVersion,
	clinicalSubmissionSystemDisabled,
} from './clinical-resolvers/clinicalSubmissions';

// Mutation
import commitClinicalRegistration from './clinical-mutations/commitRegistration';
import clearClinicalRegistration from './clinical-mutations/clearRegistration';
import clearClinicalSubmission from './clinical-mutations/clearClinicalSubmission';
import validateClinicalSubmission from './clinical-mutations/validateClinicalSubmission';
import commitClinicalSubmission from './clinical-mutations/commitClinicalSubmission';
import reopenClinicalSubmission from './clinical-mutations/reopenClinicalSubmission';
import approveClinicalSubmission from './clinical-mutations/approveClinicalSubmission';

const resolvers = {
	Query: {
		clinicalData,
		clinicalErrors,
		clinicalRegistration,
		clinicalSearchResults,
		clinicalSubmissions,
		clinicalSubmissionTypesList,
		clinicalSubmissionSchemaVersion,
		clinicalSubmissionSystemDisabled,
	},
	Mutation: {
		clearClinicalSubmission,
		validateClinicalSubmission,
		commitClinicalSubmission,
		clearClinicalRegistration,
		commitClinicalRegistration,
		reopenClinicalSubmission,
		approveClinicalSubmission,
	},
};

export default resolvers;
