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
      console.log(`field : ${field} has changes`);
      const fieldDiff = fieldChange.diff;
      // if we have type at first level then it's a field add/delete
      if (isFieldChange(fieldDiff)) {
        categorizeFieldChanges(analysis, field, fieldDiff);
      }

      if (isNestedChange(fieldDiff)) {
        if (fieldDiff.meta) {
          console.log('meta change found');
          categorizeMetaChagnes(analysis, field, fieldDiff.meta);
        }

        if (fieldDiff.restrictions) {
          console.log('restrictions change found');
          categorizeRestrictionChanges(analysis, field, fieldDiff.restrictions);
        }
      }
    }
  }

  return analysis;
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
