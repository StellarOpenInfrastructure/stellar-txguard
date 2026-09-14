import type { ParsedTransaction } from "../transaction-parser/types.js";
import type { PolicyDecision } from "../policy-engine/types.js";
import type { SimulationResult } from "../simulation/types.js";

export interface RiskSignal {
  /** Stable identifier, e.g. "UNKNOWN_DESTINATION". */
  id: string;
  /** Contribution to the score in [0, 100]. */
  weight: number;
  message: string;
  operationIndex?: number;
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskAssessment {
  /** 0 (no risk detected) to 100. */
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
}

export interface RiskContext {
  tx: ParsedTransaction;
  policyDecision?: PolicyDecision;
  simulation?: SimulationResult;
  /** Destinations the caller has interacted with before. */
  knownDestinations?: ReadonlySet<string>;
  /** Contracts the caller has interacted with before. */
  knownContracts?: ReadonlySet<string>;
}

/** A heuristic inspects the context and returns zero or more signals. */
export interface RiskHeuristic {
  id: string;
  evaluate(ctx: RiskContext): RiskSignal[];
}
