import { assetKey } from "../transaction-parser/types.js";
import { fromUnits, selectorMatches, toUnits, totalsByAsset } from "./amounts.js";
import type { EvaluationContext, Violation } from "./types.js";

type RuleResult = { violations: Violation[]; skipped?: string };
type Rule = (ctx: EvaluationContext) => Promise<RuleResult> | RuleResult;

const DAY_MS = 24 * 60 * 60 * 1000;

function allTransfers(ctx: EvaluationContext) {
  return ctx.tx.operations.flatMap((op) =>
    op.transfers.map((t) => ({ ...t, operationIndex: op.index })),
  );
}

export const maxAmount: Rule = (ctx) => {
  const limits = ctx.policy.rules.max_amount ?? [];
  const violations: Violation[] = [];
  const totals = totalsByAsset(allTransfers(ctx));
  for (const limit of limits) {
    for (const { asset, total } of totals.values()) {
      if (!selectorMatches(limit.asset, asset)) continue;
      let cap: bigint;
      try {
        cap = toUnits(limit.amount, asset);
      } catch {
        // A decimal limit applied via "*" to a contract asset is not comparable; skip loudly.
        violations.push({
          rule: "max_amount",
          code: "MAX_AMOUNT_UNCOMPARABLE",
          message: `limit ${limit.amount} cannot be applied to ${assetKey(asset)} (contract assets require integer limits)`,
          context: { asset: assetKey(asset) },
        });
        continue;
      }
      if (total > cap) {
        violations.push({
          rule: "max_amount",
          code: "MAX_AMOUNT_EXCEEDED",
          message: `total ${fromUnits(total, asset)} of ${assetKey(asset)} exceeds limit ${limit.amount}`,
          context: { asset: assetKey(asset), total: fromUnits(total, asset), limit: limit.amount },
        });
      }
    }
  }
  return { violations };
};

export const blockedAssets: Rule = (ctx) => {
  const blocked = ctx.policy.rules.blocked_assets ?? [];
  const violations: Violation[] = [];
  for (const t of allTransfers(ctx)) {
    if (blocked.some((sel) => selectorMatches(sel, t.asset))) {
      violations.push({
        rule: "blocked_assets",
        code: "ASSET_BLOCKED",
        message: `asset ${assetKey(t.asset)} is blocked by policy`,
        operationIndex: t.operationIndex,
        context: { asset: assetKey(t.asset) },
      });
    }
  }
  return { violations };
};

export const allowedAssets: Rule = (ctx) => {
  const allowed = ctx.policy.rules.allowed_assets;
  if (!allowed) return { violations: [] };
  const violations: Violation[] = [];
  for (const t of allTransfers(ctx)) {
    if (!allowed.some((sel) => selectorMatches(sel, t.asset))) {
      violations.push({
        rule: "allowed_assets",
        code: "ASSET_NOT_ALLOWED",
        message: `asset ${assetKey(t.asset)} is not in the allowed list`,
        operationIndex: t.operationIndex,
        context: { asset: assetKey(t.asset) },
      });
    }
  }
  return { violations };
};

export const allowedDestinations: Rule = (ctx) => {
  const allowed = ctx.policy.rules.allowed_destinations;
  if (!allowed) return { violations: [] };
  const set = new Set(allowed);
  const violations: Violation[] = [];
  for (const t of allTransfers(ctx)) {
    if (!set.has(t.destination)) {
      violations.push({
        rule: "allowed_destinations",
        code: "DESTINATION_NOT_ALLOWED",
        message: `destination ${t.destination} is not in the allowed list`,
        operationIndex: t.operationIndex,
        context: { destination: t.destination },
      });
    }
  }
  return { violations };
};

export const requiredMemo: Rule = (ctx) => {
  const req = ctx.policy.rules.required_memo;
  if (!req) return { violations: [] };
  const memo = ctx.tx.memo;
  if (memo.type === "none") {
    return {
      violations: [
        { rule: "required_memo", code: "MEMO_MISSING", message: "policy requires a memo" },
      ],
    };
  }
  if (typeof req === "object" && !(req.types as string[]).includes(memo.type)) {
    return {
      violations: [
        {
          rule: "required_memo",
          code: "MEMO_TYPE_NOT_ALLOWED",
          message: `memo type ${memo.type} is not one of ${req.types.join(", ")}`,
          context: { memoType: memo.type },
        },
      ],
    };
  }
  return { violations: [] };
};

export const simulationRequired: Rule = (ctx) => {
  if (!ctx.policy.rules.simulation_required) return { violations: [] };
  if (!ctx.tx.isSoroban) return { violations: [] };
  if (!ctx.simulation) {
    return {
      violations: [
        {
          rule: "simulation_required",
          code: "SIMULATION_MISSING",
          message: "policy requires a simulation result",
        },
      ],
    };
  }
  if (ctx.simulation.status !== "success") {
    return {
      violations: [
        {
          rule: "simulation_required",
          code: "SIMULATION_FAILED",
          message: `simulation ${ctx.simulation.status}: ${ctx.simulation.error ?? "unknown error"}`,
        },
      ],
    };
  }
  return { violations: [] };
};

export const contractAllowlist: Rule = (ctx) => {
  const allow = ctx.policy.rules.contract_allowlist;
  if (!allow) return { violations: [] };
  const set = new Set(allow);
  const violations: Violation[] = [];
  for (const op of ctx.tx.operations) {
    if (!op.contract) continue;
    if (op.contract.hostFunctionType !== "invoke_contract") {
      violations.push({
        rule: "contract_allowlist",
        code: "CONTRACT_DEPLOY_NOT_ALLOWED",
        message: `host function ${op.contract.hostFunctionType} is not permitted when a contract allowlist is set`,
        operationIndex: op.index,
      });
      continue;
    }
    if (!op.contract.contractId || !set.has(op.contract.contractId)) {
      violations.push({
        rule: "contract_allowlist",
        code: "CONTRACT_NOT_ALLOWED",
        message: `contract ${op.contract.contractId ?? "<unknown>"} is not in the allowlist`,
        operationIndex: op.index,
        context: { contractId: op.contract.contractId ?? "" },
      });
    }
  }
  return { violations };
};

export const dailyLimit: Rule = async (ctx) => {
  const limits = ctx.policy.rules.daily_limit ?? [];
  if (limits.length === 0) return { violations: [] };
  if (!ctx.spendingLedger) return { violations: [], skipped: "no SpendingLedger configured" };
  const now = ctx.now ?? new Date();
  const violations: Violation[] = [];
  const totals = totalsByAsset(allTransfers(ctx));
  for (const limit of limits) {
    for (const [key, { asset, total }] of totals) {
      if (!selectorMatches(limit.asset, asset)) continue;
      let cap: bigint;
      try {
        cap = toUnits(limit.amount, asset);
      } catch {
        continue;
      }
      const spent = await ctx.spendingLedger.spentInWindow(ctx.tx.source, key, DAY_MS, now);
      if (spent + total > cap) {
        violations.push({
          rule: "daily_limit",
          code: "DAILY_LIMIT_EXCEEDED",
          message: `spending ${fromUnits(spent + total, asset)} of ${key} in 24h would exceed limit ${limit.amount}`,
          context: {
            asset: key,
            spent: fromUnits(spent, asset),
            attempted: fromUnits(total, asset),
            limit: limit.amount,
          },
        });
      }
    }
  }
  return { violations };
};

export const RULES: { name: keyof EvaluationContext["policy"]["rules"]; run: Rule }[] = [
  { name: "blocked_assets", run: blockedAssets },
  { name: "allowed_assets", run: allowedAssets },
  { name: "max_amount", run: maxAmount },
  { name: "allowed_destinations", run: allowedDestinations },
  { name: "required_memo", run: requiredMemo },
  { name: "contract_allowlist", run: contractAllowlist },
  { name: "simulation_required", run: simulationRequired },
  { name: "daily_limit", run: dailyLimit },
];
