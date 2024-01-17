# Exceptions

Exceptions are cases where submitted data is allowed to differ from the dictionary schema. These are allowed because the dictionary is quite strict and there are many edge cases where a submitting program has data to contribute but will never be able to provide certain select pieces of information.

When this is the case, the submitting program requests an exception through the DCC. A DCC admin can then use the clinical service API to add exceptions for that submitting program.

## Categories of Exceptions

There are two main categories of exceptions:

1. Property Exceptions
2. Missing Entity Exceptions

### Property Exceptions

A property exception is a case where a specific property from a schema cannot be provided. Property exceptions apply to a specific property in a specific schema. In place of the required value for that property, the submitting program will provide:

- For a string property, they will use an agreed on string in place of the required value. Examples: `Unknown` or `Not Applicable`
- For a numeric property, they will provide no value and this value will remain `undefined`.

Property exceptions can be granted for either a specific entity or for an entire program.

> Note: All exceptions specify a `requested_exception_value`. This is a string value that describes why a valid value cannot be provided. Initially, the values `Unknown` and `Not applicable` are allowed.
>
> For numeric fields, a `requested_exception_value` is required even though the actual value allowed will be `undefined`. This requested value can be used as a reference for WHY the field was allowed to be omitted.

#### Program Property Exceptions

If a program property exception is added, then any record submitted by that program can provide the exception value instead of the value required by the data dictionary. These are used in cases where the program is always or mostly unable to provide this value for any record.

The program property exception model is defined in [repo/program.ts](./repo/program.ts).

Multiple property exceptions can exist per program. Each exception must specify:

- schema name
- property name
- program short name
- requested exception value

#### Entity Property Exception

An exception can also be granted for a specific entity. These exceptions provide a specific `donor_submitter_id` for the entity they apply to. This entity is used to validate data of the specified schema type if the data record belongs to the specified donor and program.

Entity property exceptions are defined in [repo/entity.ts](./repo/entity.ts).

Each entity property exception must specify:

- schema name
- property name
- program short name
- requested exception value
- donor

### Missing Entity Exception

It is possible for a submitting program to have lost contact with a donor before all the core entity data has been collected. For this donor's data to be used in ARGO we need to grant them an exception so that they can be processed and their analysed data released into the embargo process despite missing core entity data. These cases apply to donors that are missing Treatment or Follow Up entity records. All other core entities (Donor, Specimen, Sample, Primary Diagnosis) are still required.

These missing entity exceptions apply to individual donors for a program. A donor with such an exception has updated requirements when calculating if that donor is "core complete".

For a missing entity exception to be valid, the donor's data must have a value for the `lost_to_followup_after_clinical_event_id` property of their donor schema. If they have this value and a missing entity exception, then the donor can be marked as core complete even if they are missing Treatment and/or Follow Up entity records.

A donor that is marked core complete due to an exception will have an additional property added to their core complete data `lostToFollowupException` with a value `true`.
