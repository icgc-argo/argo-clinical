import { schemaClient } from './schema-rest-client';
import {
  SchemasDictionaryDiffs,
  FieldChanges,
  FieldDiff,
  FieldDefinition,
  Change,
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
  const analysis = {
    fields: {
      addedFields: new Array<string>(),
      renamedFields: new Array<string>(),
      deletedFields: new Array<string>(),
    },
    restrictionsChanges: {
      codeLists: {
        addition: new Array<string>(),
        deletion: new Array<string>(),
      },
    },
  };

  for (const field of Object.keys(changes)) {
    const fieldChange: FieldDiff = changes[field];
    if (fieldChange) {
      const changes = fieldChange.diff;
      // if we have type at first level then it's a field add/delete
      if (isFieldChange(changes)) {
        categorizeFieldChanges(analysis, field, changes);
      }

      if (isNestedChange(changes)) {
        if (changes.meta) {
        }
        if (changes.restrictions) {
        }
      }
    }
  }
};

const categorizeRestrictionChanges = (restrictions: { [field: string]: FieldChanges }) => {
  if (restrictions.codeLists) {
    const codeListChange = restrictions.codeLists as Change;
    if (codeListChange.type === 'updated') {
    }
  }
};
const categorizeFieldChanges = (analysis: any, field: string, changes: FieldChanges) => {
  const changeType = changes.type;
  if (changeType == 'created') {
    analysis.fields.addedFields.push(field);
  } else if (changeType == 'deleted') {
    analysis.fields.deletedFields.push(field);
  }
};
