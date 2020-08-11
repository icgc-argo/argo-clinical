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

import {
  SubmissionValidationError,
  SubmittedClinicalRecord,
  DataValidationErrors,
  SubmissionValidationOutput,
} from '../submission-entities';
import {
  ClinicalEntitySchemaNames,
  FollowupFieldsEnum,
  ClinicalUniqueIdentifier,
  PrimaryDiagnosisFieldsEnum,
} from '../../common-model/entities';
import { DeepReadonly } from 'deep-freeze';
import { Donor, Treatment } from '../../clinical/clinical-entities';
import _ from 'lodash';
import { getClinicalEntitiesFromDonorBySchemaName } from '../../common-model/functions';
import { getEntitySubmitterIdFieldName } from '../../common-model/functions';
import * as utils from './utils';
export const validate = async (
  followUpRecord: DeepReadonly<SubmittedClinicalRecord>,
  existentDonor: DeepReadonly<Donor>,
  mergedDonor: Donor,
): Promise<SubmissionValidationOutput> => {
  // ***Basic pre-check (to prevent execution if missing required variables)***
  if (!followUpRecord || !existentDonor) {
    throw new Error("Can't call this function without followup records");
  }
  const errors: SubmissionValidationError[] = [];

  // check if a primary diagnosis is specified that it exists
  utils.checkRelatedEntityExists(
    ClinicalEntitySchemaNames.PRIMARY_DIAGNOSIS,
    followUpRecord,
    ClinicalEntitySchemaNames.FOLLOW_UP,
    mergedDonor,
    errors,
    false,
  );

  // check if a treatment is specified that it exists
  utils.checkRelatedEntityExists(
    ClinicalEntitySchemaNames.TREATMENT,
    followUpRecord,
    ClinicalEntitySchemaNames.FOLLOW_UP,
    mergedDonor,
    errors,
    false,
  );

  const entitySubmitterIdField = getEntitySubmitterIdFieldName(ClinicalEntitySchemaNames.TREATMENT);
  const treatment = utils.getRelatedEntityByFK(
    ClinicalEntitySchemaNames.TREATMENT,
    followUpRecord[entitySubmitterIdField] as string,
    mergedDonor,
  ) as DeepReadonly<Treatment>;

  checkTreatmentTimeConflict(followUpRecord, treatment, errors);

  const followUpClinicalInfo = getExistingFollowUp(existentDonor, followUpRecord);
  // adding new follow up to this donor ?
  if (!followUpClinicalInfo) {
    // check it is unique in this program
    await utils.checkClinicalEntityDoesntBelongToOtherDonor(
      ClinicalEntitySchemaNames.FOLLOW_UP,
      followUpRecord,
      existentDonor,
      errors,
    );
  }
  return { errors };
};

function checkTreatmentTimeConflict(
  followUpRecord: DeepReadonly<SubmittedClinicalRecord>,
  treatment: DeepReadonly<Treatment>,
  errors: SubmissionValidationError[],
) {
  // A follow up may or may not be associated with treatment
  if (treatment == undefined) return;

  if (
    followUpRecord.interval_of_followup &&
    treatment.clinicalInfo &&
    treatment.clinicalInfo.treatment_start_interval &&
    followUpRecord.interval_of_followup <= treatment.clinicalInfo.treatment_start_interval
  ) {
    errors.push(
      utils.buildSubmissionError(
        followUpRecord,
        DataValidationErrors.FOLLOW_UP_CONFLICING_INTERVAL,
        FollowupFieldsEnum.interval_of_followup,
        [],
      ),
    );
  }
}

function getExistingFollowUp(
  existingDonor: DeepReadonly<Donor>,
  record: DeepReadonly<SubmittedClinicalRecord>,
) {
  if (existingDonor.followUps) {
    return getClinicalEntitiesFromDonorBySchemaName(
      existingDonor,
      ClinicalEntitySchemaNames.FOLLOW_UP,
    ).find(
      ci =>
        ci[FollowupFieldsEnum.submitter_follow_up_id] ==
        record[FollowupFieldsEnum.submitter_follow_up_id],
    );
  }
  return undefined;
}
