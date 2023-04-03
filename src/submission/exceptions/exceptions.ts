/**
 * Checks if there is a program exception matching the record value
 *
 * @param exceptions
 * @param validationError
 * @param recordValue
 * @returns true if an exception match exists, false otherwise
 */
export const checkExceptionExists = (
  exceptions: DeepReadonly<ProgramException['exceptions']>,
  validationError: DeepReadonly<dictionaryEntities.SchemaValidationError>,
  recordValue: string,
): boolean => {
  // missing required field, validate as normal, exceptions still require a submitted value
  if (
    validationError.errorType ===
    dictionaryEntities.SchemaValidationErrorTypes.MISSING_REQUIRED_FIELD
  ) {
    return false;
  } else {
    // find exception for field
    const validationErrorFieldName = validationError.fieldName;
    const exception = findException({ exceptions, record, validationErrorFieldName });

    // check exception value matches error field value
    return exception?.requested_exception_value === record[validationErrorFieldName];
  }
};

const findException = ({
  exceptions,
  record,
  validationErrorFieldName,
}: {
  exceptions: ExceptionRecords;
  record: DataRecord;
  validationErrorFieldName: string;
}): ProgramExceptionRecord | EntityExceptionRecord | undefined => {
  if (isArrayOfEntityExceptionRecord(exceptions)) {
    // entity exception
    return exceptions.find(
      exception =>
        exception.requested_core_field === validationErrorFieldName &&
        findExceptionByEntity({ exception, record }),
    );
  } else {
    // program exception
    return exceptions.find(exception => {
      exception.requested_core_field === validationErrorFieldName;
    });
  }
};

const specimenKeyField: keyof SpecimenExceptionRecord = 'submitter_specimen_id';
const findExceptionByEntity = ({
  exception,
  record,
}: {
  exception: EntityExceptionRecord;
  record: DataRecord;
}) => {
  // NB: keep type checks as string literals for current project TS version 3.9.5
  if ('submitter_specimen_id' in exception) {
    return exception[specimenKeyField] === record[specimenKeyField];
  } else {
    return false;
  }
};

const applyExceptions = async ({
  programId,
  entity,
  record,
  schemaValidationErrors,
}: {
  programId: string;
  entity: string;
  record: dictionaryEntities.DataRecord;
  schemaValidationErrors: dictionaryEntities.SchemaValidationError[];
}): Promise<dictionaryEntities.SchemaValidationError[]> => {
  const t0 = performance.now();
  // program exceptions and entity exceptions are mutually exclusive

  // program level exceptions
  const programExceptionResult = await programExceptionRepository.find(programId);
  if (isProgramException(programExceptionResult)) {
    return schemaValidationErrors.filter(
      validationError =>
        !isException({ exceptions: programExceptionResult.exceptions, validationError, record }),
    );
  }

  // entity level exceptions
  const entityExceptionResult = await entityExceptionRepository.find(programId);
  if (
    isEntityException(entityExceptionResult) &&
    (entity === EntityValues.followup || entity === EntityValues.specimen)
  ) {
    const entityExceptions = entityExceptionResult[entity];

    return schemaValidationErrors.filter(
      validationError => !isException({ exceptions: entityExceptions, validationError, record }),
    );
  }

  const t1 = performance.now();
  L.debug('apply exceptions time: ' + (t1 - t0));
  return schemaValidationErrors;
};

/**
 * Normalizes input string to start with Upper case, remaining
 * characters lowercase and to trim whitespace
 *
 * @param value
 * returns normalized string
 */
export const normalizeExceptionValue = (value: string) => _.upperFirst(value.trim().toLowerCase());
