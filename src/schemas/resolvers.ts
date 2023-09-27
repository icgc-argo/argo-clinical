import clinicalRegistration from './clinical-resolvers/clinicalRegistrationData';
import clinicalSearchResultResolver from './clinical-resolvers/clinicalSearchResults';
import clinicalSubmissions from './clinical-resolvers/clinicalSubmissionData';
import clearClinicalSubmission from './clinical-resolvers/clearClinicalSubmission';
import validateClinicalSubmissions from './clinical-resolvers/validateClinicalSubmission';
import commitClinicalSubmission from './clinical-resolvers/commitClinicalSubmission';
import reopenClinicalSubmission from './clinical-resolvers/reopenClinicalSubmission';
import approveClinicalSubmission from './clinical-resolvers/approveClinicalSubmission';

const resolvers = {
  Query: {
    clinicalRegistration,
    ...clinicalSearchResultResolver,
    clinicalSubmissions,
  },
  Mutation: {
    clearClinicalSubmission,
    validateClinicalSubmissions,
    commitClinicalSubmission,
    reopenClinicalSubmission,
    approveClinicalSubmission,
  },
};

export default resolvers;
