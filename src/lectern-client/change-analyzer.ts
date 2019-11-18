import { schemaClient } from './schema-rest-client';
import {
  SchemasDictionaryDiffs,
  FieldChanges,
  FieldDiff,
  FieldDefinition,
  Change,
  ChangeAnalysis,
  StringAttributeChange,
  RegexChanges,
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
  const restrictionsToCheck = ['regex', 'script', 'required'];

  // additions or deletions of a restriction object as whole (i.e. contains 1 or many restrictions within the 'data')
  if (restrictionsChange.type) {
    const createOrAddChange = restrictionsChange as Change;
    const restrictionsData = createOrAddChange.data as any;
    const restrictionsToCheck = ['regex', 'script', 'required'];

    for (const k of restrictionsToCheck) {
      if (restrictionsData[k]) {
        analysis.restrictionsChanges[k as keyof RestrictionChanges][
          restrictionsChange.type as ChangeTypeName
        ].push({
          field: field,
          value: restrictionsData[k],
        } as any);
      }
    }

    if (restrictionsData.codeList) {
      if (restrictionsChange.type === 'created') {
        analysis.restrictionsChanges.codeList.created.push({
          field: field,
          addition: restrictionsData.codeList,
          deletion: [],
        });
      }

      if (restrictionsChange.type === 'deleted') {
        analysis.restrictionsChanges.codeList.deleted.push({
          field: field,
          addition: [],
          deletion: [],
        });
      }
    }
  }

  const restrictionUpdate = restrictionsChange as { [field: string]: FieldChanges };
  // codelist
  if (restrictionUpdate.codeList) {
    console.log('codeLists change found');
    const codeListChange = restrictionUpdate.codeList as Change;

    if (codeListChange.type === 'updated') {
      analysis.restrictionsChanges.codeList.updated.push({
        field: field,
        addition: codeListChange.data.added || [],
        deletion: codeListChange.data.deleted || [],
      });
    }

    if (codeListChange.type === 'created') {
      analysis.restrictionsChanges.codeList.created.push({
        field: field,
        addition: codeListChange.data,
        deletion: [],
      });
    }

    if (codeListChange.type === 'deleted') {
      analysis.restrictionsChanges.codeList.deleted.push({
        field: field,
        addition: [],
        deletion: [],
      });
    }
  }

  for (const k of restrictionsToCheck) {
    if (restrictionUpdate[k]) {
      const change = restrictionUpdate[k] as Change;
      analysis.restrictionsChanges[k as keyof RestrictionChanges][
        change.type as ChangeTypeName
      ].push({
        field: field,
        value: change.data,
      } as any);
    }
  }

  if (restrictions.range) {
    console.log('range change found');
    const rangeChange = restrictions.range as Change;

    if (rangeChange.type === 'created') {
      analysis.restrictionsChanges.script.created.push({
        field: field,
        value: rangeChange.data,
      });
    }

    if (rangeChange.type === 'deleted') {
      analysis.restrictionsChanges.script.deleted.push({
        field: field,
        value: rangeChange.data,
      });
    }

    if (rangeChange.type === 'updated') {
      analysis.restrictionsChanges.script.updated.push({
        field: field,
        value: rangeChange.data,
      });
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
