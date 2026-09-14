import type { ParsedTransaction } from "../transaction-parser/types.js";
import type { SimulationResult } from "../simulation/types.js";
import type { Policy } from "./schema.js";

export type RuleName = keyof Policy["rules"];

export interface Violation {
  rule: RuleName;
  /** Stable machine-readable code, e.g. "MAX_AMOUNT_EXCEEDED". */
  code: string;
  message: string;
  /** Index of the offending operation, if the violation is operation-specific. */
  operationIndex?: number;
  /** Extra structured context safe to expose to API consumers. */
  context?: Record<string, string | number | boolean>;
}

export type Verdict = "allow" | "deny" | "review";

export interface PolicyDecision {
  verdict: Verdict;
  policyName: string;
  violations: Violation[];
  /** Rules that were skipped because required context was missing (e.g. no ledger). */
  skipped: { rule: RuleName; reason: string }[];
  evaluatedAt: string;
}

/**
 * Tracks spending per (account, asset) so `daily_limit` can be enforced.
 * Implementations must be safe to call concurrently for the same key.
 */
export interface SpendingLedger {
  /** Units spent by `account` in `asset` within the rolling window ending at `now`. */
  spentInWindow(account: string, assetKey: string, windowMs: number, now: Date): Promise<bigint>;
  /** Record a spend that has been (or is about to be) submitted. */
  record(account: string, assetKey: string, units: bigint, at: Date): Promise<void>;
}

export interface EvaluationContext {
  tx: ParsedTransaction;
  policy: Policy;
  simulation?: SimulationResult;
  spendingLedger?: SpendingLedger;
  now?: Date;
}
