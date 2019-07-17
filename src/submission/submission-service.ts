import * as dataValidator from "./validation";
import { donorDao } from "../clinical/donor-repo";
import { registrationRepository } from "./registration-repo";
import { Donor } from "../clinical/clinical-entities";
import { RegisterDonorDto } from "../clinical/donor-repo";
import { ActiveRegistration, RegistrationRecord } from "./submission-entities";
import * as manager from "../lectern-client/schema-manager";
import { SchemaValidationErrors } from "../lectern-client/schema-entities";
import { loggerFor } from "../logger";
const L = loggerFor(__filename);

export namespace operations {
  /**
   * This method creates an in progress registration after validating but doesn't create the donors in the donor collection
   * it overrides and deletes any previously uncomitted registrations.
   * @param command CreateRegistrationCommand the records to register,
   *  can contain new donors or existing donors but new samples.
   */
  export const createRegistration = async (
    command: CreateRegistrationCommand
  ): Promise<CreateRegistrationResult> => {
    const fullyPopulatedRecords = manager.populateDefaults("registration", command.records);
    const schemaErrors: SchemaValidationErrors = manager.validate(
      "registration",
      fullyPopulatedRecords
    );

    // if there are errors terminate the creation.
    if (anyErrors(schemaErrors)) {
      L.info(`found ${schemaErrors.recordsErrors.length} schema errors in registration attempt`);
      return {
        registrationId: undefined,
        state: undefined,
        errors: schemaErrors.recordsErrors,
        successful: false
      };
    }

    const registrationRecords = mapToRegistrationRecord(command);
    const { errors: dataErrors } = dataValidator.validateRegistrationData(registrationRecords);
    if (dataErrors.length > 0) {
      L.info(`found ${dataErrors.length} data errors in registration attempt`);
      return {
        registrationId: undefined,
        state: undefined,
        errors: dataErrors,
        successful: false
      };
    }
    // build the registration object
    const registration: ActiveRegistration = toActiveRegistration(command, registrationRecords);

    // delete any existing active registration to replace it with the new one
    // we can only have 1 active registration per program
    const existingActivRegistration = await registrationRepository.findByProgramId(
      command.programId
    );
    if (existingActivRegistration != undefined && existingActivRegistration.id) {
      await registrationRepository.delete(existingActivRegistration.id);
    }

    // save the new registration object
    const savedRegistration = await registrationRepository.create(registration);
    return {
      registrationId: savedRegistration.id,
      state: "uncommitted",
      errors: [],
      successful: true
    };
  };

  /**
   * TBD
   * This method will move the registered donor document to donor collection
   * and remove it from active registration collection.
   *
   * @param command CommitRegistrationCommand the id of the registration to close.
   */
  export const commitRegisteration = async (
    command: Readonly<CommitRegistrationCommand>
  ): Promise<void> => {
    const donor: RegisterDonorDto = {
      submitterId: "DONOR1000",
      gender: "male",
      programId: "PEME-CA",
      specimens: [
        {
          samples: [
            {
              sampleType: "RNA",
              submitterId: "SAMP1038RNA"
            }
          ],
          submitterId: "SPEC10999"
        }
      ]
    };
    const created: Donor = await donorDao.register(donor);
  };

  /**
   * find registration by program Id
   * @param programId string
   */
  export const findByProgramId = async (programId: string) => {
    return await registrationRepository.findByProgramId(programId);
  };

  /************* Private methods *************/
  function toActiveRegistration(
    command: CreateRegistrationCommand,
    registrationRecords: ReadonlyArray<CreateRegistrationRecord>
  ): Readonly<ActiveRegistration> {
    return {
      programId: command.programId,
      creator: command.creator,
      records: registrationRecords.map(r => {
        const record: Readonly<RegistrationRecord> = {
          donorSubmitterId: r.donorSubmitterId,
          gender: r.gender,
          specimenSubmitterId: r.specimenSubmitterId,
          specimenType: r.specimenType,
          tumourNormalDesignation: r.tumourNormalDesignation,
          sampleSubmitterId: r.sampleSubmitterId,
          sampleType: r.sampleType
        };
        return record;
      })
    };
  }

  function anyErrors(schemaErrors: SchemaValidationErrors) {
    return schemaErrors.generalErrors.length > 0 || schemaErrors.recordsErrors.length > 0;
  }

  function mapToRegistrationRecord(
    command: CreateRegistrationCommand
  ): ReadonlyArray<CreateRegistrationRecord> {
    return command.records.map(r => {
      const rec: CreateRegistrationRecord = {
        programId: r.program_id,
        donorSubmitterId: r.donor_submitter_id,
        gender: r.gender,
        specimenSubmitterId: r.specimen_submitter_id,
        specimenType: r.specimen_type,
        tumourNormalDesignation: r.tumour_normal_designation,
        sampleSubmitterId: r.sample_submitter_id,
        sampleType: r.sample_type
      };
      return rec;
    });
  }
}

export interface CreateRegistrationRecord {
  readonly programId: string;
  readonly donorSubmitterId: string;
  readonly gender: string;
  readonly specimenSubmitterId: string;
  readonly specimenType: string;
  readonly tumourNormalDesignation: string;
  readonly sampleSubmitterId: string;
  readonly sampleType: string;
}

export interface CommitRegistrationCommand {
  readonly registrationId: string;
}

export interface CreateRegistrationCommand {
  // we define the records as arbitrary key value pairs to be validated by the schema
  // before we put them in a CreateRegistrationRecord, in case a column is missing so we let dictionary handle error collection.
  records: ReadonlyArray<Readonly<{ [key: string]: string }>>;
  readonly creator: string;
  readonly programId: string;
}

export interface CreateRegistrationResult {
  readonly registrationId: string | undefined;
  readonly state: string | undefined;
  readonly successful: boolean;
  errors: ReadonlyArray<Readonly<any>>;
}

export interface ValidationResult {
  errors: ReadonlyArray<Readonly<any>>;
}
