import { describe, expect, it } from "vitest";
import {
  Account,
  BASE_FEE,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { TxGuard } from "./inspector.js";
import { StaticSimulator } from "./simulation/static-simulator.js";
import { buildTx, DEST, PASSPHRASE, policy, SOURCE } from "./test-support/fixtures.js";

const CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 7));

function sorobanXdr(): string {
  return new TransactionBuilder(new Account(SOURCE.publicKey(), "1"), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.invokeContractFunction({ contract: CONTRACT, function: "hello", args: [] }),
    )
    .setTimeout(30)
    .build()
    .toXDR();
}

describe("TxGuard.inspect", () => {
  it("recommends sign for a compliant low-risk payment", async () => {
    const guard = new TxGuard();
    const report = await guard.inspect({
      envelopeXdr: buildTx(),
      networkPassphrase: PASSPHRASE,
      policy: policy({ max_amount: [{ asset: "native", amount: "100" }] }),
      knownDestinations: new Set([DEST.publicKey()]),
    });
    expect(report.policy.verdict).toBe("allow");
    expect(report.recommendation).toBe("sign");
  });

  it("recommends reject on a policy violation", async () => {
    const guard = new TxGuard();
    const report = await guard.inspect({
      envelopeXdr: buildTx(),
      networkPassphrase: PASSPHRASE,
      policy: policy({ max_amount: [{ asset: "native", amount: "1" }] }),
    });
    expect(report.recommendation).toBe("reject");
  });

  it("runs simulation for Soroban transactions and enforces simulation_required", async () => {
    const failing = new TxGuard({
      simulator: new StaticSimulator({ status: "error", error: "HostError" }),
    });
    const report = await failing.inspect({
      envelopeXdr: sorobanXdr(),
      networkPassphrase: PASSPHRASE,
      policy: policy({ simulation_required: true, contract_allowlist: [CONTRACT] }),
    });
    expect(report.simulation?.status).toBe("error");
    expect(report.policy.violations.map((v) => v.code)).toEqual(["SIMULATION_FAILED"]);
    expect(report.recommendation).toBe("reject");

    const passing = new TxGuard({
      simulator: new StaticSimulator({ status: "success", minResourceFee: "100" }),
    });
    const ok = await passing.inspect({
      envelopeXdr: sorobanXdr(),
      networkPassphrase: PASSPHRASE,
      policy: policy({ simulation_required: true, contract_allowlist: [CONTRACT] }),
      knownContracts: new Set([CONTRACT]),
    });
    expect(ok.policy.verdict).toBe("allow");
    expect(ok.recommendation).toBe("sign");
  });

  it("sends high-risk but policy-compliant transactions to review", async () => {
    const guard = new TxGuard({ reviewAtRiskLevel: "medium" });
    const report = await guard.inspect({
      envelopeXdr: buildTx(),
      networkPassphrase: PASSPHRASE,
      policy: policy({}),
      knownDestinations: new Set(), // destination unknown → +25
    });
    expect(report.policy.verdict).toBe("allow");
    expect(report.risk.level).toBe("medium");
    expect(report.recommendation).toBe("review");
  });
});
