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

import gql from 'graphql-tag';

const typeDefs = gql`
  type Query {
    """
    Retrieve all stored Clinical Entity and Donor Completion data for a program
    """
    clinicalData(programShortName: String!, filters: ClinicalInput!): ClinicalData!

    """
    Retrieve all stored Clinical Migration Errors for a program
    """
    clinicalErrors(programShortName: String!, donorIds: [Int]): [ClinicalErrors!]!

    """
    Retrieve current stored Clinical Registration data for a program
    """
    clinicalRegistration(shortName: String!): ClinicalRegistrationData!

    """
    Retrieve DonorIds + Submitter Donor Ids for given Clinical Entity and Program
    """
    clinicalSearchResults(programShortName: String!, filters: ClinicalInput!): ClinicalSearchData!

    """
    Retrieve current stored Clinical Submission data for a program
    """
    clinicalSubmissions(programShortName: String!): ClinicalSubmissionData!

    """
    Retrieve current stored Clinical Submission Data Dictionary Schema version
    """
    clinicalSubmissionSchemaVersion: String!

    """
    Retrieve current Clinical Submission disabled state for both sample_registration and clinical entity files
    """
    clinicalSubmissionSystemDisabled: Boolean!

    """
    Retrieve current stored Clinical Submission Types list
    """
    clinicalSubmissionTypesList(includeFields: String): [SchemaList]!
  }

  type Mutation {
    """
    Remove the Clinical Registration data currently uploaded and not committed
    """
    clearClinicalRegistration(shortName: String!, registrationId: String!): Boolean!

    """
    Complete registration of the currently uploaded Clinical Registration data
    On Success, returns a list of the new sample IDs that were committed
    """
    commitClinicalRegistration(shortName: String!, registrationId: String!): [String]!

    """
    Clear Clinical Submission
    fileType is optional, if it is not provided all fileTypes will be cleared. The values for fileType are the same as the file names from each template (ex. donor, specimen)
    """
    clearClinicalSubmission(
      programShortName: String!
      version: String!
      fileType: String
    ): ClinicalSubmissionData!

    """
    Validate the uploaded clinical files
    """
    validateClinicalSubmissions(
      programShortName: String!
      version: String!
    ): ClinicalSubmissionData!

    """
    - If there is update: makes a clinical submission ready for approval by a DCC member,
    returning submission data with updated state
    - If there is NO update: merges clinical data to system, returning an empty submission
    """
    commitClinicalSubmission(programShortName: String!, version: String!): ClinicalSubmissionData!
  }

  scalar DateTime

  """
  Query Variables for Pagination & Filtering
  """
  input ClinicalInput {
    page: Int!
    pageSize: Int!
    sort: String
    entityTypes: [String]
    donorIds: [Int]
    submitterDonorIds: [String]
    completionState: String
  }

  """
  Collated Clinical Data Query Response
  """
  type ClinicalData {
    programShortName: String!
    clinicalEntities: [ClinicalDataEntities]!
    completionStats: [CompletionStats]
    clinicalErrors: [ClinicalErrors]!
  }

  """
  Clinical Data DonorId Search Query Response
  """
  type ClinicalSearchData {
    programShortName: String!
    searchResults: [ClinicalSearchResults]!
    totalResults: Int!
  }

  """
  Clinical Data DonorId Search Result Record
  """
  type ClinicalSearchResults {
    donorId: Int!
    submitterDonorId: String
  }

  """
  Submitted Program Clinical Data arranged by Entity type
  """
  type ClinicalDataEntities {
    entityName: String!
    totalDocs: Int!
    records: [[ClinicalRecordField]]!
    entityFields: [String]
    completionStats: [CompletionStats]
  }

  """
  Data Submission / Schema Errors for a given Donor
  """
  type ClinicalErrors {
    donorId: Int
    submitterDonorId: String
    entityName: String
    errors: [ClinicalErrorRecord]
  }

  """
  Specific Error Field + Values
  """
  type ClinicalErrorRecord {
    errorType: String
    fieldName: String
    index: Int
    info: ClinicalErrorInfo
    message: String
    entityName: String
  }

  type ClinicalErrorInfo {
    value: [String]
    message: String
  }

  """
  Completion Data for a given Donor
  """
  type CompletionStats {
    coreCompletion: CoreCompletionFields
    coreCompletionDate: String
    coreCompletionPercentage: Float
    overriddenCoreCompletion: [String]
    donorId: Int
    entityData: CompletionEntityData
  }

  """
  Specific Entity Completion Values
  """
  type CoreCompletionFields {
    donor: Float!
    specimens: Float!
    primaryDiagnosis: Float!
    followUps: Float!
    treatments: Float!
  }

  """
  Display Data For Core Completion Entities
  """
  type CompletionEntityData {
    specimens: SpecimenCoreCompletion
  }

  type SpecimenCoreCompletion {
    coreCompletionPercentage: Float!
    normalSpecimensPercentage: Float!
    tumourSpecimensPercentage: Float!
    normalRegistrations: Float!
    normalSubmissions: Float!
    tumourRegistrations: Float!
    tumourSubmissions: Float!
  }

  """
  It is possible for there to be no available ClinicalRegistrationData for a program,
    in this case the object will return with id and creator equal to null, and an empty records list.
  """
  type ClinicalRegistrationData {
    id: ID
    programShortName: ID
    creator: String
    fileName: String
    createdAt: DateTime
    records: [ClinicalRecord]!
    errors: [ClinicalRegistrationError]!
    fileErrors: [ClinicalFileError]

    newDonors: ClinicalRegistrationStats!
    newSpecimens: ClinicalRegistrationStats!
    newSamples: ClinicalRegistrationStats!
    alreadyRegistered: ClinicalRegistrationStats!
  }

  type ClinicalRegistrationStats {
    count: Int!
    rows: [Int]!
    names: [String]!
    values: [ClinicalRegistrationStatValue]!
  }

  """
  Generic schema of clinical tsv records
  """
  type ClinicalRecord {
    row: Int!
    fields: [ClinicalRecordField!]!
  }

  type ClinicalRecordField {
    name: String!
    value: String
  }

  """
  All schemas below describe clinical errors
  """
  type ClinicalFileError {
    message: String!
    fileNames: [String]!
    code: String!
  }

  type ClinicalRegistrationError implements ClinicalEntityError {
    type: String!
    message: String!
    row: Int!
    field: String!
    value: String!
    sampleId: String
    donorId: String!
    specimenId: String
  }

  interface ClinicalEntityError {
    type: String!
    message: String!
    row: Int!
    field: String!
    value: String!
    donorId: String!
  }

  type ClinicalRegistrationStatValue {
    name: String!
    rows: [Int]!
  }

  """
  Clinical Submission Data
  """
  type ClinicalSubmissionData {
    id: ID
    programShortName: ID
    state: SubmissionState
    version: String
    updatedBy: String
    updatedAt: DateTime
    clinicalEntities: [ClinicalSubmissionEntity]!
    fileErrors: [ClinicalFileError]
  }

  enum SubmissionState {
    OPEN
    VALID
    INVALID
    PENDING_APPROVAL
    INVALID_BY_MIGRATION
  }

  type ClinicalSubmissionEntity {
    clinicalType: String!
    batchName: String
    creator: String
    records: [ClinicalRecord]!
    stats: ClinicalSubmissionStats
    dataErrors: [ClinicalSubmissionDataError]!
    schemaErrors: [ClinicalSubmissionSchemaError]!
    dataUpdates: [ClinicalSubmissionUpdate]!
    dataWarnings: [ClinicalSubmissionSchemaError]!
    createdAt: DateTime
  }

  """
  Each field is an array of row index referenced in ClinicalSubmissionRecord
  """
  type ClinicalSubmissionStats {
    noUpdate: [Int]!
    new: [Int]!
    updated: [Int]!
    errorsFound: [Int]!
  }

  type ClinicalSubmissionDataError implements ClinicalEntityError {
    type: String!
    message: String!
    row: Int!
    field: String!
    value: String!
    donorId: String!
  }

  type ClinicalSubmissionSchemaError implements ClinicalEntityError {
    type: String!
    message: String!
    row: Int!
    field: String!
    value: String!
    donorId: String!
    clinicalType: String!
  }

  type ClinicalSubmissionUpdate {
    row: Int!
    field: String!
    newValue: String!
    oldValue: String!
    donorId: String!
  }

  scalar SchemaList
`;

export default typeDefs;
