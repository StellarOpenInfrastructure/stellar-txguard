import { describe, expect, it } from "vitest";
import { Asset, Memo, Operation, StrKey } from "@stellar/stellar-sdk";
import { parseTransaction } from "../transaction-parser/parser.js";
import {
  evaluatePolicy,
  InMemorySpendingLedger,
  loadPolicyFromYaml,
  validatePolicy,
} from "./engine.js";
import { TxGuardError } from "../errors.js";
import {
  buildTx,
  DEST,
  OTHER,
  PASSPHRASE,
  policy,
  SOURCE,
  USDC,
  USDC_KEY,
} from "../test-support/fixtures.js";

const tx = (xdr = buildTx()) => parseTransaction(xdr, PASSPHRASE);

describe("policy validation", () => {
  it("accepts a minimal policy", () => {
    const p = validatePolicy({ version: 1, name: "min", rules: {} });
    expect(p.on_violation).toBe("deny");
  });

  it("rejects unknown rules", () => {
    expect(() => validatePolicy({ version: 1, name: "x", rules: { max_amout: [] } })).toThrowError(
      TxGuardError,
    );
  });

  it("rejects malformed asset selectors", () => {
    expect(() =>
      validatePolicy({ version: 1, name: "x", rules: { allowed_assets: ["USDC"] } }),
    ).toThrow();
  });

  it("loads YAML", () => {
    const p = loadPolicyFromYaml(`version: 1\nname: yaml\nrules:\n  required_memo: true\n`);
    expect(p.rules.required_memo).toBe(true);
  });

  it("rejects invalid YAML", () => {
    expect(() => loadPolicyFromYaml("version: [1")).toThrowError(TxGuardError);
  });
});

describe("rules", () => {
  it("allows when no rules apply", async () => {
    const d = await evaluatePolicy({ tx: tx(), policy: policy({}) });
    expect(d.verdict).toBe("allow");
    expect(d.violations).toEqual([]);
  });

  it("max_amount sums transfers of the same asset", async () => {
    const xdr = buildTx({
      ops: [
        Operation.payment({ destination: DEST.publicKey(), asset: Asset.native(), amount: "6" }),
        Operation.payment({ destination: OTHER.publicKey(), asset: Asset.native(), amount: "5" }),
      ],
    });
    const d = await evaluatePolicy({
      tx: tx(xdr),
      policy: policy({ max_amount: [{ asset: "native", amount: "10" }] }),
    });
    expect(d.verdict).toBe("deny");
    expect(d.violations[0]!.code).toBe("MAX_AMOUNT_EXCEEDED");
    expect(d.violations[0]!.context?.total).toBe("11");
  });

  it("max_amount with wildcard applies to every asset", async () => {
    const xdr = buildTx({
      ops: [Operation.payment({ destination: DEST.publicKey(), asset: USDC, amount: "0.0000001" })],
    });
    const ok = await evaluatePolicy({
      tx: tx(xdr),
      policy: policy({ max_amount: [{ asset: "*", amount: "0.0000001" }] }),
    });
    expect(ok.verdict).toBe("allow");
    const bad = await evaluatePolicy({
      tx: tx(xdr),
      policy: policy({ max_amount: [{ asset: "*", amount: "0" }] }),
    });
    expect(bad.verdict).toBe("deny");
  });

  it("blocked_assets denies", async () => {
    const xdr = buildTx({
      ops: [Operation.payment({ destination: DEST.publicKey(), asset: USDC, amount: "1" })],
    });
    const d = await evaluatePolicy({ tx: tx(xdr), policy: policy({ blocked_assets: [USDC_KEY] }) });
    expect(d.violations.map((v) => v.code)).toEqual(["ASSET_BLOCKED"]);
  });

  it("allowed_assets denies unlisted assets", async () => {
    const d = await evaluatePolicy({ tx: tx(), policy: policy({ allowed_assets: [USDC_KEY] }) });
    expect(d.violations.map((v) => v.code)).toEqual(["ASSET_NOT_ALLOWED"]);
    const ok = await evaluatePolicy({ tx: tx(), policy: policy({ allowed_assets: ["native"] }) });
    expect(ok.verdict).toBe("allow");
  });

  it("allowed_destinations denies unknown destinations", async () => {
    const d = await evaluatePolicy({
      tx: tx(),
      policy: policy({ allowed_destinations: [OTHER.publicKey()] }),
    });
    expect(d.violations[0]!.code).toBe("DESTINATION_NOT_ALLOWED");
    expect(d.violations[0]!.operationIndex).toBe(0);
  });

  it("required_memo", async () => {
    const missing = await evaluatePolicy({ tx: tx(), policy: policy({ required_memo: true }) });
    expect(missing.violations[0]!.code).toBe("MEMO_MISSING");
    const wrongType = await evaluatePolicy({
      tx: tx(buildTx({ memo: Memo.text("hi") })),
      policy: policy({ required_memo: { types: ["id"] } }),
    });
    expect(wrongType.violations[0]!.code).toBe("MEMO_TYPE_NOT_ALLOWED");
    const ok = await evaluatePolicy({
      tx: tx(buildTx({ memo: Memo.id("7") })),
      policy: policy({ required_memo: { types: ["id"] } }),
    });
    expect(ok.verdict).toBe("allow");
  });

  it("simulation_required only applies to Soroban transactions", async () => {
    const d = await evaluatePolicy({ tx: tx(), policy: policy({ simulation_required: true }) });
    expect(d.verdict).toBe("allow");
  });

  it("contract_allowlist ignores classic transactions", async () => {
    const d = await evaluatePolicy({
      tx: tx(),
      policy: policy({ contract_allowlist: [StrKey.encodeContract(Buffer.alloc(32, 7))] }),
    });
    expect(d.verdict).toBe("allow");
  });

  it("on_violation: review yields review verdict", async () => {
    const d = await evaluatePolicy({ tx: tx(), policy: policy({ required_memo: true }, "review") });
    expect(d.verdict).toBe("review");
  });

  it("daily_limit is skipped without a ledger and enforced with one", async () => {
    const p = policy({ daily_limit: [{ asset: "native", amount: "15" }] });
    const skipped = await evaluatePolicy({ tx: tx(), policy: p });
    expect(skipped.verdict).toBe("allow");
    expect(skipped.skipped[0]!.rule).toBe("daily_limit");

    const ledger = new InMemorySpendingLedger();
    const now = new Date("2026-01-01T12:00:00Z");
    await ledger.record(
      SOURCE.publicKey(),
      "native",
      60_000_000n,
      new Date("2026-01-01T10:00:00Z"),
    ); // 6 XLM
    const ok = await evaluatePolicy({ tx: tx(), policy: p, spendingLedger: ledger, now }); // 6 + 10 <= 15? no → 16 > 15
    expect(ok.violations[0]!.code).toBe("DAILY_LIMIT_EXCEEDED");

    // Spending older than 24h is ignored.
    const ledger2 = new InMemorySpendingLedger();
    await ledger2.record(
      SOURCE.publicKey(),
      "native",
      60_000_000n,
      new Date("2025-12-30T10:00:00Z"),
    );
    const fresh = await evaluatePolicy({ tx: tx(), policy: p, spendingLedger: ledger2, now });
    expect(fresh.verdict).toBe("allow");
  });
});
