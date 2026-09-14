import { z } from "zod";

/**
 * Asset selector syntax used throughout policies:
 *   "native"                  — XLM
 *   "USDC:GA5ZSE...ISSUER"    — classic issued asset (CODE:ISSUER)
 *   "contract:CABC..."        — Soroban token contract
 *   "*"                       — any asset (only valid where documented)
 */
export const assetSelectorSchema = z
  .string()
  .min(1)
  .regex(
    /^(\*|native|[A-Za-z0-9]{1,12}:G[A-Z2-7]{55}|contract:C[A-Z2-7]{55})$/,
    "invalid asset selector",
  );

export const amountStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,7})?$/, "amount must be a decimal string with at most 7 fractional digits");

export const accountIdSchema = z.string().regex(/^[GCM][A-Z2-7]{55}$/, "invalid Stellar address");
export const contractIdSchema = z.string().regex(/^C[A-Z2-7]{55}$/, "invalid contract id");

export const amountLimitSchema = z.object({
  asset: assetSelectorSchema.default("*"),
  amount: amountStringSchema,
});

export const memoRequirementSchema = z.union([
  z.boolean(),
  z.object({ types: z.array(z.enum(["text", "id", "hash", "return"])).min(1) }),
]);

export const policyRulesSchema = z
  .object({
    /** Per-transaction ceiling per asset. Sums all transfers of the asset in the tx. */
    max_amount: z.array(amountLimitSchema).optional(),
    /** If set, every transferred asset must match one selector. */
    allowed_assets: z.array(assetSelectorSchema).optional(),
    /** Any transfer of a listed asset is a violation. Evaluated before allowed_assets. */
    blocked_assets: z.array(assetSelectorSchema).optional(),
    /** If set, every transfer destination must be listed. */
    allowed_destinations: z.array(accountIdSchema).optional(),
    /** Require a memo (optionally of specific types). */
    required_memo: memoRequirementSchema.optional(),
    /** Require a successful simulation result to be present for Soroban transactions. */
    simulation_required: z.boolean().optional(),
    /** If set, every contract invocation must target a listed contract id. */
    contract_allowlist: z.array(contractIdSchema).optional(),
    /** Rolling 24h limit per asset for the transaction source. Requires a SpendingLedger. */
    daily_limit: z.array(amountLimitSchema).optional(),
  })
  .strict();

export const policySchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1).max(120),
    description: z.string().max(2000).optional(),
    /** Verdict applied when a rule fails. "review" surfaces the tx for manual approval. */
    on_violation: z.enum(["deny", "review"]).default("deny"),
    rules: policyRulesSchema,
  })
  .strict();

export type Policy = z.infer<typeof policySchema>;
export type PolicyInput = z.input<typeof policySchema>;
export type PolicyRules = z.infer<typeof policyRulesSchema>;
export type AmountLimit = z.infer<typeof amountLimitSchema>;
