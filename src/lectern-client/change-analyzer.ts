import { schemaClient } from './schema-rest-client';
import {
  SchemasDictionaryDiffs,
  FieldChanges,
  FieldDiff,
  FieldDefinition,
  Change,
  ChangeAnalysis,
  RegexChange,
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

export const analyzeChanges = async (
  serviceUrl: string,
  name: string,
  fromVersion: string,
  toVersion: string,
): Promise<ChangeAnalysis> => {
  const changes = await schemaClient.fetchDiff(serviceUrl, name, fromVersion, toVersion);

  const analysis: ChangeAnalysis = {
    fields: {
      addedFields: [],
      renamedFields: [],
      deletedFields: [],
    },
    restrictionsChanges: {
      codeLists: {
        created: [],
        deleted: [],
        updated: [],
      },
      regex: {
        updated: [],
        created: [],
        deleted: [],
      },
    },
  };

  for (const field of Object.keys(changes)) {
    const fieldChange: FieldDiff = changes[field];
    if (fieldChange) {
      console.log(`field : ${field} has changes`);
      const changes = fieldChange.diff;
      // if we have type at first level then it's a field add/delete
      if (isFieldChange(changes)) {
        categorizeFieldChanges(analysis, field, changes);
      }

      if (isNestedChange(changes)) {
        if (changes.meta) {
          console.log('meta change found');
        }

        if (changes.restrictions) {
          console.log('restrictions change found');
          categorizeRestrictionChanges(analysis, field, changes.restrictions as {
            [field: string]: FieldChanges;
          });
        }
      }
    }
  }

  return analysis;
};

const categorizeRestrictionChanges = (
  analysis: ChangeAnalysis,
  field: string,
  restrictions: { [field: string]: FieldChanges },
) => {
  // codelist
  if (restrictions.codeList) {
    console.log('codeLists change found');
    const codeListChange = restrictions.codeList as Change;

    if (codeListChange.type === 'updated') {
      analysis.restrictionsChanges.codeLists.updated.push({
        field: field,
        addition: codeListChange.data.added || [],
        deletion: codeListChange.data.deleted || [],
      });
    }

    if (codeListChange.type === 'created') {
      analysis.restrictionsChanges.codeLists.created.push({
        field: field,
        addition: codeListChange.data,
        deletion: [],
      });
    }

    if (codeListChange.type === 'deleted') {
      analysis.restrictionsChanges.codeLists.deleted.push({
        field: field,
        addition: [],
        deletion: [],
      });
    }
  }

  // regex
  if (restrictions.regex) {
    console.log('regex change found');
    const regexChange = restrictions.regex as Change;

    if (regexChange.type === 'created') {
      analysis.restrictionsChanges.regex.created.push({
        field: field,
        regex: regexChange.data,
      });
    }

    if (regexChange.type === 'deleted') {
      analysis.restrictionsChanges.regex.deleted.push({
        field: field,
        regex: regexChange.data,
      });
    }

    if (regexChange.type === 'updated') {
      analysis.restrictionsChanges.regex.updated.push({
        field: field,
        regex: regexChange.data,
      });
    }
  }
};

const categorizeFieldChanges = (analysis: ChangeAnalysis, field: string, changes: FieldChanges) => {
  const changeType = changes.type;
  if (changeType == 'created') {
    analysis.fields.addedFields.push(field);
  } else if (changeType == 'deleted') {
    analysis.fields.deletedFields.push(field);
  }
};
