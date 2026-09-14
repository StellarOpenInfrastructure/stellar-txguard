import { DEFAULT_HEURISTICS } from "./heuristics.js";
import type { RiskAssessment, RiskContext, RiskHeuristic, RiskLevel } from "./types.js";

export function levelForScore(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 20) return "medium";
  return "low";
}

export class RiskEngine {
  constructor(private readonly heuristics: RiskHeuristic[] = DEFAULT_HEURISTICS) {}

  assess(ctx: RiskContext): RiskAssessment {
    const signals = this.heuristics.flatMap((h) => h.evaluate(ctx));
    // Weights are additive but capped: several weak signals should not read as critical.
    const raw = signals.reduce((sum, s) => sum + s.weight, 0);
    const score = Math.min(100, raw);
    return { score, level: levelForScore(score), signals };
  }
}
