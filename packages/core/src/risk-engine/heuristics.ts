import type { RiskHeuristic, RiskSignal } from "./types.js";

export const unknownDestination: RiskHeuristic = {
  id: "unknown-destination",
  evaluate(ctx) {
    if (!ctx.knownDestinations) return [];
    const signals: RiskSignal[] = [];
    for (const op of ctx.tx.operations) {
      for (const t of op.transfers) {
        if (!ctx.knownDestinations.has(t.destination)) {
          signals.push({
            id: "UNKNOWN_DESTINATION",
            weight: 25,
            message: `first transfer to ${t.destination}`,
            operationIndex: op.index,
          });
        }
      }
    }
    return signals;
  },
};

export const unknownContract: RiskHeuristic = {
  id: "unknown-contract",
  evaluate(ctx) {
    if (!ctx.knownContracts) return [];
    return ctx.tx.operations
      .filter((op) => op.contract?.contractId && !ctx.knownContracts!.has(op.contract.contractId))
      .map((op) => ({
        id: "UNKNOWN_CONTRACT",
        weight: 30,
        message: `first invocation of contract ${op.contract!.contractId}`,
        operationIndex: op.index,
      }));
  },
};

export const contractDeployment: RiskHeuristic = {
  id: "contract-deployment",
  evaluate(ctx) {
    return ctx.tx.operations
      .filter((op) => op.contract && op.contract.hostFunctionType !== "invoke_contract")
      .map((op) => ({
        id: "CONTRACT_DEPLOYMENT",
        weight: 20,
        message: `transaction ${op.contract!.hostFunctionType === "upload_wasm" ? "uploads wasm" : "deploys a contract"}`,
        operationIndex: op.index,
      }));
  },
};

export const missingMemo: RiskHeuristic = {
  id: "missing-memo",
  evaluate(ctx) {
    const hasTransfer = ctx.tx.operations.some((op) => op.transfers.length > 0);
    if (hasTransfer && ctx.tx.memo.type === "none") {
      return [{ id: "MISSING_MEMO", weight: 5, message: "transfer without memo" }];
    }
    return [];
  },
};

export const manyOperations: RiskHeuristic = {
  id: "many-operations",
  evaluate(ctx) {
    const n = ctx.tx.operations.length;
    if (n >= 20)
      return [{ id: "MANY_OPERATIONS", weight: 15, message: `${n} operations in one transaction` }];
    if (n >= 5)
      return [{ id: "MANY_OPERATIONS", weight: 5, message: `${n} operations in one transaction` }];
    return [];
  },
};

export const dangerousOperations: RiskHeuristic = {
  id: "dangerous-operations",
  evaluate(ctx) {
    const dangerous = new Set([
      "setOptions",
      "accountMerge",
      "changeTrust",
      "setTrustLineFlags",
      "clawback",
    ]);
    return ctx.tx.operations
      .filter((op) => dangerous.has(op.type))
      .map((op) => ({
        id: "SENSITIVE_OPERATION",
        weight: op.type === "accountMerge" || op.type === "setOptions" ? 40 : 15,
        message: `operation ${op.type} can change account control or trust`,
        operationIndex: op.index,
      }));
  },
};

export const simulationProblems: RiskHeuristic = {
  id: "simulation-problems",
  evaluate(ctx) {
    if (!ctx.simulation) return [];
    if (ctx.simulation.status === "error") {
      return [{ id: "SIMULATION_ERROR", weight: 50, message: "simulation failed" }];
    }
    if (ctx.simulation.status === "restore_required") {
      return [
        { id: "RESTORE_REQUIRED", weight: 10, message: "archived ledger entries must be restored" },
      ];
    }
    return [];
  },
};

export const policyViolations: RiskHeuristic = {
  id: "policy-violations",
  evaluate(ctx) {
    if (!ctx.policyDecision) return [];
    return ctx.policyDecision.violations.map((v) => ({
      id: `POLICY_${v.code}`,
      weight: 30,
      message: v.message,
      ...(v.operationIndex !== undefined ? { operationIndex: v.operationIndex } : {}),
    }));
  },
};

export const noTimeBounds: RiskHeuristic = {
  id: "no-time-bounds",
  evaluate(ctx) {
    if (!ctx.tx.timeBounds || ctx.tx.timeBounds.maxTime === "0") {
      return [
        {
          id: "NO_TIME_BOUNDS",
          weight: 5,
          message: "transaction never expires (no max time bound)",
        },
      ];
    }
    return [];
  },
};

export const DEFAULT_HEURISTICS: RiskHeuristic[] = [
  unknownDestination,
  unknownContract,
  contractDeployment,
  missingMemo,
  manyOperations,
  dangerousOperations,
  simulationProblems,
  policyViolations,
  noTimeBounds,
];
