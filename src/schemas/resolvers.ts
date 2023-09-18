import clinicalRegistration from './clinical-resolvers/clinicalRegistrationData';
import clinicalSearchResult from './clinical-resolvers/clinicalSearchResults';
import clinicalSubmissions, {
  clinicalSubmissionTypesList,
  clinicalSubmissionSchemaVersion,
  clinicalSubmissionSystemDisabled,
} from './clinical-resolvers/clinicalSubmissionDataResolver';
import clearClinicalSubmission from './clinical-resolvers/clearClinicalSubmissionResolver';
import validateClinicalSubmission from './clinical-resolvers/validateClinicalSubmissionResolver';
import commitClinicalSubmission from './clinical-resolvers/commitClinicalSubmission';

const resolvers = {
  Query: {
    clinicalRegistration,
    clinicalSearchResult,
    clinicalSubmissions,
    clinicalSubmissionTypesList,
    clinicalSubmissionSchemaVersion,
    clinicalSubmissionSystemDisabled,
  },
  Mutation: {
    clearClinicalSubmission,
    validateClinicalSubmission,
    commitClinicalSubmission,
  },
};

export default resolvers;
