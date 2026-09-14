import { parseTransaction } from "./transaction-parser/parser.js";
import type { ParsedTransaction } from "./transaction-parser/types.js";
import { evaluatePolicy } from "./policy-engine/engine.js";
import type { Policy } from "./policy-engine/schema.js";
import type { PolicyDecision, SpendingLedger } from "./policy-engine/types.js";
import type { SimulationResult, Simulator } from "./simulation/types.js";
import { RiskEngine } from "./risk-engine/engine.js";
import type { RiskAssessment } from "./risk-engine/types.js";

export interface InspectionRequest {
  envelopeXdr: string;
  networkPassphrase: string;
  policy: Policy;
  /** Skip simulation even if a simulator is configured. */
  skipSimulation?: boolean;
  knownDestinations?: ReadonlySet<string>;
  knownContracts?: ReadonlySet<string>;
  now?: Date;
}

export interface InspectionReport {
  transaction: ParsedTransaction;
  policy: PolicyDecision;
  simulation?: SimulationResult;
  risk: RiskAssessment;
  /** Final recommendation combining policy verdict and risk level. */
  recommendation: "sign" | "review" | "reject";
}

export interface TxGuardOptions {
  simulator?: Simulator;
  spendingLedger?: SpendingLedger;
  riskEngine?: RiskEngine;
  /** Risk level at or above which an otherwise allowed transaction is sent to review. */
  reviewAtRiskLevel?: "medium" | "high" | "critical";
}

const LEVEL_ORDER = { low: 0, medium: 1, high: 2, critical: 3 } as const;

/**
 * TxGuard orchestrates parse → simulate → policy → risk for a single transaction.
 * It never signs or submits anything.
 */
export class TxGuard {
  private readonly riskEngine: RiskEngine;

  constructor(private readonly opts: TxGuardOptions = {}) {
    this.riskEngine = opts.riskEngine ?? new RiskEngine();
  }

  async inspect(req: InspectionRequest): Promise<InspectionReport> {
    const transaction = parseTransaction(req.envelopeXdr, req.networkPassphrase);

    let simulation: SimulationResult | undefined;
    if (transaction.isSoroban && this.opts.simulator && !req.skipSimulation) {
      simulation = await this.opts.simulator.simulate(req.envelopeXdr, req.networkPassphrase);
    }

    const policy = await evaluatePolicy({
      tx: transaction,
      policy: req.policy,
      ...(simulation ? { simulation } : {}),
      ...(this.opts.spendingLedger ? { spendingLedger: this.opts.spendingLedger } : {}),
      ...(req.now ? { now: req.now } : {}),
    });

    const risk = this.riskEngine.assess({
      tx: transaction,
      policyDecision: policy,
      ...(simulation ? { simulation } : {}),
      ...(req.knownDestinations ? { knownDestinations: req.knownDestinations } : {}),
      ...(req.knownContracts ? { knownContracts: req.knownContracts } : {}),
    });

    const reviewLevel = this.opts.reviewAtRiskLevel ?? "high";
    let recommendation: InspectionReport["recommendation"];
    if (policy.verdict === "deny") recommendation = "reject";
    else if (policy.verdict === "review") recommendation = "review";
    else if (LEVEL_ORDER[risk.level] >= LEVEL_ORDER[reviewLevel]) recommendation = "review";
    else recommendation = "sign";

    return { transaction, policy, ...(simulation ? { simulation } : {}), risk, recommendation };
  }
}
