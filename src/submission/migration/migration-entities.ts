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

import { entities as dictionaryEntities } from '@overturebio-stack/lectern-client';

export type MigrationStage = 'SUBMITTED' | 'ANALYZED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type MigrationState = 'OPEN' | 'CLOSED';

export interface DictionaryMigration {
  _id?: string;
  fromVersion: string;
  toVersion: string;
  state: MigrationState;
  stage: MigrationStage;
  dryRun: boolean;
  analysis: any;
  stats: {
    totalProcessed: number;
    validDocumentsCount: number;
    invalidDocumentsCount: number;
  };
  invalidDonorsErrors: any[];
  checkedSubmissions: any[];
  invalidSubmissions: any[];
  programsWithDonorUpdates: string[];
  createdBy: string;
  newSchemaErrors?: NewSchemaVerificationResult | string;
}

export type DonorMigrationError = {
  donorId?: number;
  submitterDonorId: string;
  programId: string;
  errors: DonorMigrationSchemaErrors;
};

export type NewSchemaVerificationResult = {
  [clinicalEntity: string]: {
    missingFields?: string[];
    invalidFieldCodeLists?: { fieldName: string; missingCodeListValue: string[] }[];
    valueTypeChanges?: string[];
    errorMessage?: string;
  };
};

export interface DonorMigrationErrorRecord extends dictionaryEntities.SchemaValidationError {
  entityName: string;
}

export type DonorMigrationSchemaErrors = Array<{
  [clinicalType: string]: ReadonlyArray<dictionaryEntities.SchemaValidationError>;
}>;
