// uploadClinicalRegistration: async (
//   obj: unknown,
//   args: {
//     shortName: string;
//     registrationFile: FileUpload;
//   },
//   context: GlobalGqlContext,
// ) => {
//   const { Authorization, egoToken } = context;
//   const { shortName, registrationFile } = args;
//   const permissions = egoTokenUtils.getPermissionsFromToken(egoToken);
//   // Here we are confirming that the user has at least some ability to write Program Data
//   // This is to reduce the opportunity for spamming the gateway with file uploads
//   if (!egoTokenUtils.canWriteSomeProgramData(permissions)) {
//     throw new AuthenticationError('User is not authorized to write data');
//   }

//   const { filename, createReadStream } = await registrationFile;
//   const fileStream = createReadStream();

//   // try {
//   const response = await clinicalService.uploadRegistrationData(
//     shortName,
//     filename,
//     fileStream,
//     Authorization,
//   );

//   return convertRegistrationDataToGql(shortName, response);
// },
