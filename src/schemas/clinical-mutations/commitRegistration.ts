// commitClinicalRegistration: async (
//   obj: unknown,
//   args: { shortName: string; registrationId: string },
//   context: GlobalGqlContext,
// ) => {
//   const { Authorization } = context;
//   const { shortName, registrationId } = args;
//   const response = await clinicalService.commitRegistrationData(
//     shortName,
//     registrationId,
//     Authorization,
//   );
//   return get(response, 'newSamples', []);
// },
