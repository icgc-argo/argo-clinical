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

import { schemaClient } from './schema-rest-client';
import {
  SchemasDictionaryDiffs,
  FieldChanges,
  FieldDiff,
  Change,
  ChangeAnalysis,
  ChangeTypeName,
  RestrictionChanges,
} from './schema-entities';

const isFieldChange = (obj: any): obj is Change => {
  return obj.type !== undefined;
};

const isNestedChange = (obj: any): obj is { [field: string]: FieldChanges } => {
  return obj.type === undefined;
};

const isRestrictionChange = (obj: any): obj is { [field: string]: FieldChanges } => {
  return obj.type === undefined;
};

export const fetchDiffAndAnalyze = async (
  serviceUrl: string,
  name: string,
  fromVersion: string,
  toVersion: string,
) => {
  const changes = await schemaClient.fetchDiff(serviceUrl, name, fromVersion, toVersion);
  return analyzeChanges(changes);
};

export const analyzeChanges = (schemasDiff: SchemasDictionaryDiffs): ChangeAnalysis => {
  const analysis: ChangeAnalysis = {
    fields: {
      addedFields: [],
      renamedFields: [],
      deletedFields: [],
    },
    isArrayDesignationChanges: [],
    restrictionsChanges: {
      codeList: {
        created: [],
        deleted: [],
        updated: [],
      },
      regex: {
        updated: [],
        created: [],
        deleted: [],
      },
      required: {
        updated: [],
        created: [],
        deleted: [],
      },
      script: {
        updated: [],
        created: [],
        deleted: [],
      },
      range: {
        updated: [],
        created: [],
        deleted: [],
      },
    },
    metaChanges: {
      core: {
        changedToCore: [],
        changedFromCore: [],
      },
    },
  };

  for (const field of Object.keys(schemasDiff)) {
    const fieldChange: FieldDiff = schemasDiff[field];
    if (fieldChange) {
      const fieldDiff = fieldChange.diff;
      // if we have type at first level then it's a field add/delete
      if (isFieldChange(fieldDiff)) {
        categorizeFieldChanges(analysis, field, fieldDiff);
      }

      if (isNestedChange(fieldDiff)) {
        if (fieldDiff.meta) {
          categorizeMetaChagnes(analysis, field, fieldDiff.meta);
        }

        if (fieldDiff.restrictions) {
          categorizeRestrictionChanges(analysis, field, fieldDiff.restrictions);
        }

        if (fieldDiff.isArray) {
          categorizeFieldArrayDesignationChange(analysis, field, fieldDiff.isArray);
        }
      }
    }
  }

  return analysis;
};

const categorizeFieldArrayDesignationChange = (
  analysis: ChangeAnalysis,
  field: string,
  changes: { [field: string]: FieldChanges } | Change,
) => {
  // changing isArray designation is a relevant change for all cases except if it is created and set to false
  if (!(changes.type === 'created' && changes.data === false)) {
    analysis.isArrayDesignationChanges.push(field);
  }
};

const categorizeRestrictionChanges = (
  analysis: ChangeAnalysis,
  field: string,
  restrictionsChange: { [field: string]: FieldChanges } | Change,
) => {
  const restrictionsToCheck = ['regex', 'script', 'required', 'codeList', 'range'];

  // additions or deletions of a restriction object as whole (i.e. contains 1 or many restrictions within the 'data')
  if (restrictionsChange.type) {
    const createOrAddChange = restrictionsChange as Change;
    const restrictionsData = createOrAddChange.data as any;

    for (const k of restrictionsToCheck) {
      if (restrictionsData[k]) {
        analysis.restrictionsChanges[k as keyof RestrictionChanges][
          restrictionsChange.type as ChangeTypeName
        ].push({
          field: field,
          definition: restrictionsData[k],
        } as any);
      }
    }
    return;
  }

  // in case 'restrictions' key was already there but we modified its contents
  const restrictionUpdate = restrictionsChange as { [field: string]: FieldChanges };
  for (const k of restrictionsToCheck) {
    if (restrictionUpdate[k]) {
      const change = restrictionUpdate[k] as Change;
      // we need the '|| change'  in case of nested attributes like ranges
      /*
      "diff": {
        "restrictions": {
          "range": {
            "exclusiveMin": {
              "type": "deleted",
              "data": 0
            },
            "max": {
              "type": "updated",
              "data": 200000
            },
            "min": {
              "type": "created",
              "data": 0
            }
          }
        }
      }
      */
      const definition = change.data || change;
      analysis.restrictionsChanges[k as keyof RestrictionChanges][
        change.type as ChangeTypeName
      ].push({
        field: field,
        definition,
      } as any);
    }
  }
};

const categorizeFieldChanges = (analysis: ChangeAnalysis, field: string, changes: Change) => {
  const changeType = changes.type;
  if (changeType == 'created') {
    analysis.fields.addedFields.push({
      name: field,
      definition: changes.data,
    });
  } else if (changeType == 'deleted') {
    analysis.fields.deletedFields.push(field);
  }
};

const categorizeMetaChagnes = (
  analysis: ChangeAnalysis,
  field: string,
  metaChanges: { [field: string]: FieldChanges } | Change,
) => {
  // **** meta changes - core ***
  if (metaChanges?.data?.core === true) {
    const changeType = metaChanges.type;
    if (changeType === 'created' || changeType === 'updated') {
      analysis.metaChanges?.core.changedToCore.push(field);
    } else if (changeType === 'deleted') {
      analysis.metaChanges?.core.changedFromCore.push(field);
    }
  }
};
