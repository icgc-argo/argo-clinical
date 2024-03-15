/**
 * Treatment Detail Exception data model
 */
export type TreatmentDetailException = {
	programId: string;
	donorSubmitterIds: string[];
};

/**
 * A simplified version of the Treatment Detail Exception that shows the total number
 * of donors with an exception for a program instead of all the donor submitter IDs
 */
export type TreatmentDetailExceptionSummary = {
	programId: string;
	donorCount: number;
};
