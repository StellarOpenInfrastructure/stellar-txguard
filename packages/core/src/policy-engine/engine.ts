import { parse as parseYaml } from "yaml";
import { TxGuardError } from "../errors.js";
import { RULES } from "./rules.js";
import { policySchema, type Policy } from "./schema.js";
import type { EvaluationContext, PolicyDecision, SpendingLedger } from "./types.js";

/** Validate an untrusted object as a Policy. */
export function validatePolicy(input: unknown): Policy {
  const result = policySchema.safeParse(input);
  if (!result.success) {
    throw new TxGuardError("INVALID_POLICY", "policy failed validation", result.error.issues);
  }
  return result.data;
}

/** Load a policy from YAML (or JSON — YAML is a superset). */
export function loadPolicyFromYaml(text: string): Policy {
  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch (err) {
    throw new TxGuardError("INVALID_POLICY", "policy is not valid YAML", {
      reason: err instanceof Error ? err.message : String(err),
    });
  }
  return validatePolicy(doc);
}

/** Evaluate every rule of the policy against the transaction. */
export async function evaluatePolicy(ctx: EvaluationContext): Promise<PolicyDecision> {
  const violations: PolicyDecision["violations"] = [];
  const skipped: PolicyDecision["skipped"] = [];
  for (const rule of RULES) {
    const result = await rule.run(ctx);
    violations.push(...result.violations);
    if (result.skipped) skipped.push({ rule: rule.name, reason: result.skipped });
  }
  return {
    verdict: violations.length === 0 ? "allow" : ctx.policy.on_violation,
    policyName: ctx.policy.name,
    violations,
    skipped,
    evaluatedAt: (ctx.now ?? new Date()).toISOString(),
  };
}

/**
 * In-memory SpendingLedger for tests and single-process deployments.
 * Production deployments should back this with PostgreSQL or Redis.
 */
export class InMemorySpendingLedger implements SpendingLedger {
  private readonly entries = new Map<string, { units: bigint; at: number }[]>();

  private key(account: string, assetKey: string): string {
    return `${account}|${assetKey}`;
  }

  async spentInWindow(
    account: string,
    assetKey: string,
    windowMs: number,
    now: Date,
  ): Promise<bigint> {
    const since = now.getTime() - windowMs;
    return (this.entries.get(this.key(account, assetKey)) ?? [])
      .filter((e) => e.at > since)
      .reduce((sum, e) => sum + e.units, 0n);
  }

  async record(account: string, assetKey: string, units: bigint, at: Date): Promise<void> {
    const k = this.key(account, assetKey);
    const list = this.entries.get(k) ?? [];
    list.push({ units, at: at.getTime() });
    this.entries.set(k, list);
  }
}
