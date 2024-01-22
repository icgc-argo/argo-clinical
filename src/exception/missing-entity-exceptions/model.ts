/**
 * Missing Entity Exception data model
 */
export type MissingEntityException = {
	programShortName: string;
	donorSubmitterIds: string[];
};

/**
 * A simplified version of the Missing Entity Exception that shows the total number
 * of donors with an exception for a program instead of all the donor submitter IDs
 */
export type MissingEntityExceptionSummary = {
	programShortName: string;
	donorCount: number;
};
