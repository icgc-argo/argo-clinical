/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
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

import { SubmissionBatchErrorTypes } from './submission-entities';
import _ from 'lodash';

const ERROR_MESSAGES: { [key: string]: (errorData: any) => string } = {
  /* ***************** *
   * VALIDATION ERRORS
   * ***************** */
  NEW_DONOR_CONFLICT: () =>
    'You are trying to register the same donor twice with different genders.',
  SAMPLE_BELONGS_TO_OTHER_SPECIMEN: errorData =>
    `Samples can only be registered to a single specimen. This sample has already been registered to specimen ${errorData.info.otherSpecimenSubmitterId}. Please correct your file or contact DCC to update the registered data.`,
  SPECIMEN_BELONGS_TO_OTHER_DONOR: errorData =>
    `Specimens can only be registered to a single donor. This specimen has already been registered to donor ${errorData.info.otherDonorSubmitterId}. Please correct your file or contact DCC to update the registered data.`,
  INVALID_PROGRAM_ID: () => 'Program ID does not match. Please include the correct Program ID.',
  MUTATING_EXISTING_DATA: errorData =>
    `The value does not match the previously registered value of ${errorData.info.originalValue}. Please correct your file or contact DCC to update the registered data.`,
  NEW_SAMPLE_ATTR_CONFLICT: () =>
    'You are trying to register the same sample with different sample types.',
  NEW_SPECIMEN_ATTR_CONFLICT: () =>
    'You are trying to register the same specimen with different values.',
  NEW_SPECIMEN_ID_CONFLICT: () =>
    'You are trying to register the same sample to multiple donors. Specimens can only be registered to a single donor.',
  NEW_SAMPLE_ID_CONFLICT: () =>
    'You are trying to register the same sample either with multiple donors, specimens or rows. Samples can only be registered once to a single donor and specimen.',
  ID_NOT_REGISTERED: errorData =>
    `${errorData.info.value} has not yet been registered. Please register samples before submitting clinical data for this identifier.`,
  CONFLICTING_TIME_INTERVAL: () =>
    'survival_time cannot be less than Specimen specimen_acquisition_interval.',

  RELATED_ENTITY_MISSING_OR_CONFLICTING: (errorData: { info: RelatedEntityErrorInfo }) =>
    `[${errorData.info.fieldName}] value in [${errorData.info.childEntity}] file requires a matching [${errorData.info.fieldName}] in [${errorData.info.parentEntity}] data. Check that it belongs to the same [submitter_donor_id] = ${errorData.info.donorSubmitterId}. It could have been previously submitted for a different donor, or if it's new in this submission, it's either missing in [${errorData.info.parentEntity}] file or this [${errorData.info.fieldName}] is associated with different [submitter_donor_id] in the [${errorData.info.parentEntity}] file.`,

  NOT_ENOUGH_INFO_TO_VALIDATE: errorData =>
    `[${errorData.fieldName}] requires [${errorData.info.missingField.join(
      '], [',
    )}] in order to complete validation.  Please upload data for all fields in this clinical data submission.`,
  FOUND_IDENTICAL_IDS: errorData => {
    if (errorData.info.useAllRecordValues === true) return `This row is identical to another row`;
    const duplicateFieldNames = errorData.info.uniqueIdNames.join(', ') || '';
    return `You are trying to submit the same [${duplicateFieldNames}] in multiple rows. [${duplicateFieldNames}] can only be submitted once per file.`;
  },
  CLINICAL_ENTITY_BELONGS_TO_OTHER_DONOR: errorData => {
    const clinicalType = _.lowerCase(errorData.info.clinicalType);
    const donorId = errorData.info.otherDonorSubmitterId;
    return `This ${clinicalType} has already been associated to donor ${donorId}. Please correct your file.`;
  },
  MISSING_THERAPY_DATA: errorData => {
    const therapyType = errorData.info.therapyType;
    const treatmentType = errorData.info.value;
    return `Treatments of type [${treatmentType}] need a corresponding [${therapyType}] record.`;
  },
  INCOMPATIBLE_PARENT_TREATMENT_TYPE: errorData => {
    const therapyType: string = errorData.info.therapyType;
    const treatmentType = errorData.info.treatment_type;
    return `[${_.startCase(
      therapyType,
    )}] records can not be submitted for treatment types of [${treatmentType}].`;
  },
  TREATMENT_ID_NOT_FOUND: () => {
    return `Treatment and treatment_type files are required to be initialized together. Please upload a corresponding treatment file in this submission.`;
  },
  MISSING_VARIABLE_REQUIREMENT: errorData => {
    const info = errorData.info;
    return `${errorData.fieldName} must be provided when the ${info.variableRequirement.fieldName} is ${info.variableRequirement.fieldValue}.`;
  },
  FORBIDDEN_PROVIDED_VARIABLE_REQUIREMENT: errorData => {
    const info = errorData.info;
    return `${errorData.fieldName} should not be provided when the ${info.variableRequirement.fieldName} is ${info.variableRequirement.fieldValue}.`;
  },
  THERAPY_RXCUI_NOT_FOUND: errorData => {
    return `This is not a valid RxNorm entry. Please verify the drug_rxnormcui.`;
  },
  THERAPY_RXNORM_DRUG_NAME_INVALID: errorData => {
    return `This is not a valid RxNorm entry. Please verify the drug_name as listed in the RxNorm database. Potential values for this id include:\n ${errorData.foundNames
      .map((d: string) => `- ${d}`)
      .join('\n')}`;
  },
};

const BATCH_ERROR_MESSAGES: Record<SubmissionBatchErrorTypes, (errorData: any) => string> = {
  [SubmissionBatchErrorTypes.TSV_PARSING_FAILED]: () =>
    `This file is formatted incorrectly. Please retain the template format with the correct headers in the first row.`,
  [SubmissionBatchErrorTypes.INVALID_FILE_NAME]: (errorData: { isRegistration: Boolean }) => {
    const exampleText = errorData.isRegistration ? 'sample_registration' : 'donor';
    return `Improperly named files cannot be uploaded or validated. Please retain the template file name and only append characters to the end (e.g. ${exampleText}<_optional_extension>.tsv).`;
  },
  [SubmissionBatchErrorTypes.INCORRECT_SECTION]: () =>
    `Please upload this file in the Register Samples section.`,
  [SubmissionBatchErrorTypes.MULTIPLE_TYPED_FILES]: errorData =>
    `Found multiple files of ${errorData.clinicalType} type`,
  [SubmissionBatchErrorTypes.MISSING_REQUIRED_HEADER]: errorData =>
    `Missing required headers: [${errorData.missingFields.join('], [')}]`,
  [SubmissionBatchErrorTypes.UNRECOGNIZED_HEADER]: errorData =>
    `Found unknown headers: [${errorData.unknownFields.join('], [')}]`,
};

// Returns the formatted message for the given error key, taking any required properties from the info object
// Default value is the errorType itself (so we can identify errorTypes that we are missing messages for and the user could look up the error meaning in our docs)
export const validationErrorMessage = (errorType: string, errorData: any = {}): string => {
  return errorType && Object.keys(ERROR_MESSAGES).includes(errorType)
    ? ERROR_MESSAGES[errorType](errorData)
    : errorType;
};

export const batchErrorMessage = (
  errorType: SubmissionBatchErrorTypes,
  errorData: any = {},
): string => {
  return BATCH_ERROR_MESSAGES[errorType](errorData);
};

export interface SubmissionErrorBaseInfo {
  donorSubmitterId: string;
  value: string;
}

export interface RelatedEntityErrorInfo extends SubmissionErrorBaseInfo {
  fieldName: string;
  childEntity: string;
  parentEntity: string;
}
