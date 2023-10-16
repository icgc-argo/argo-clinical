import { EntityAlias } from '../../common-model/entities';
import { z as zod } from 'zod';

export const CompletionState = zod.enum(['all', 'invalid', 'complete', 'incomplete']);
export type CompletionState = zod.infer<typeof CompletionState>;

/**
 * Clinical Data API Body
 */
export const ClinicalDataApiBody = zod.object({
  completionState: CompletionState.default(CompletionState.Values.all),
  entityTypes: zod.array(EntityAlias).default([]),
  donorIds: zod.array(zod.number().positive()).default([]),
  submitterDonorIds: zod.array(zod.string().nonempty()).default([]),
});
export type ClinicalDataApiBody = zod.infer<typeof ClinicalDataApiBody>;

/**
 * Clinical Error API Body
 */
export const ClinicalErrorsApiBody = zod.object({
  donorIds: zod.array(zod.number().positive()).optional(),
});
export type ClinicalErrorsApiBody = zod.infer<typeof ClinicalErrorsApiBody>;

/**
 * Clinical Search API Body
 *  - Clinical Search wants the donor IDs as strings to simplify partial match comparison
 */
export const ClinicalSearchApiBody = zod.object({
  completionState: CompletionState.default(CompletionState.Values.all),
  entityTypes: zod.array(EntityAlias).default([]),
  donorIds: zod.array(zod.number()).default([]),
  submitterDonorIds: zod.array(zod.string().nonempty()).default([]),
});
export type ClinicalSearchApiBody = zod.infer<typeof ClinicalSearchApiBody>;

/**
 * Download Donor Data by ID
 */
export const DonorDataApiBody = zod.object({
  donorIds: zod.array(zod.number().positive()).min(1),
});
export type DonorDataApiBody = zod.infer<typeof ClinicalDataApiBody>;
