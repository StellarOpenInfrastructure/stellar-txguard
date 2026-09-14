import { describe, expect, it } from "vitest";
import { Asset, Operation } from "@stellar/stellar-sdk";
import { parseTransaction } from "../transaction-parser/parser.js";
import { RiskEngine, levelForScore } from "./engine.js";
import { buildTx, DEST, PASSPHRASE } from "../test-support/fixtures.js";

describe("RiskEngine", () => {
  const engine = new RiskEngine();

  it("scores a plain payment to a known destination as low", () => {
    const tx = parseTransaction(buildTx(), PASSPHRASE);
    const r = engine.assess({ tx, knownDestinations: new Set([DEST.publicKey()]) });
    expect(r.level).toBe("low");
    expect(r.signals.map((s) => s.id)).toEqual(["MISSING_MEMO"]);
  });

  it("flags unknown destinations and sensitive operations", () => {
    const tx = parseTransaction(
      buildTx({
        ops: [
          Operation.setOptions({ masterWeight: 0 }),
          Operation.payment({ destination: DEST.publicKey(), asset: Asset.native(), amount: "1" }),
        ],
      }),
      PASSPHRASE,
    );
    const r = engine.assess({ tx, knownDestinations: new Set() });
    expect(r.signals.map((s) => s.id)).toContain("SENSITIVE_OPERATION");
    expect(r.signals.map((s) => s.id)).toContain("UNKNOWN_DESTINATION");
    expect(r.level).toBe("high"); // 40 + 25 + 5
  });

  it("caps the score at 100 and maps levels", () => {
    expect(levelForScore(0)).toBe("low");
    expect(levelForScore(20)).toBe("medium");
    expect(levelForScore(50)).toBe("high");
    expect(levelForScore(75)).toBe("critical");
    const tx = parseTransaction(buildTx({ timeout: 0 }), PASSPHRASE);
    const r = engine.assess({
      tx,
      knownDestinations: new Set(),
      simulation: { status: "error", error: "boom" },
      policyDecision: {
        verdict: "deny",
        policyName: "p",
        violations: [{ rule: "max_amount", code: "X", message: "x" }],
        skipped: [],
        evaluatedAt: "",
      },
    });
    expect(r.score).toBe(100);
    expect(r.level).toBe("critical");
  });
});
