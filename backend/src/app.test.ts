import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  Account,
  Asset,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { StaticStellarClient } from "@stellar-txguard/core";
import { buildApp, type App } from "./app.js";
import { loadConfig } from "./config.js";
import { PolicyStore } from "./policy-store.js";

const SOURCE = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1));
const DEST = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2));

function paymentXdr(amount: string): string {
  const tx = new TransactionBuilder(new Account(SOURCE.publicKey(), "1"), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({ destination: DEST.publicKey(), asset: Asset.native(), amount }),
    )
    .setTimeout(60)
    .build();
  tx.sign(SOURCE);
  return tx.toXDR();
}

describe("API", () => {
  let app: App;

  beforeAll(async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      POLICY_DIR: "/nonexistent",
    });
    const store = new PolicyStore();
    store.create("strict", {
      version: 1,
      name: "strict",
      rules: { max_amount: [{ asset: "native", amount: "5" }] },
    });
    app = await buildApp(config, { store, stellar: new StaticStellarClient(1234) });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health and /ready", async () => {
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ status: "ok" });
    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toMatchObject({ status: "ready", checks: { rpc: "ledger 1234" } });
  });

  it("echoes and generates request ids", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "abc-123" },
    });
    expect(res.headers["x-request-id"]).toBe("abc-123");
    const res2 = await app.inject({ method: "GET", url: "/health" });
    expect(res2.headers["x-request-id"]).toBeTruthy();
  });

  it("lists, fetches and creates policies", async () => {
    const list = await app.inject({ method: "GET", url: "/api/v1/policies" });
    expect(list.json()).toEqual({ items: [{ id: "strict", name: "strict" }] });

    const missing = await app.inject({ method: "GET", url: "/api/v1/policies/nope" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("POLICY_NOT_FOUND");

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/policies",
      payload: { id: "memo", version: 1, name: "memo", rules: { required_memo: true } },
    });
    expect(created.statusCode).toBe(201);

    const dup = await app.inject({
      method: "POST",
      url: "/api/v1/policies",
      payload: { id: "memo", version: 1, name: "memo", rules: {} },
    });
    expect(dup.statusCode).toBe(409);

    const invalid = await app.inject({
      method: "POST",
      url: "/api/v1/policies",
      payload: {
        id: "bad",
        version: 1,
        name: "bad",
        rules: { max_amount: [{ asset: "USDC", amount: "1" }] },
      },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("inspects a transaction against a stored policy", async () => {
    const ok = await app.inject({
      method: "POST",
      url: "/api/v1/inspect",
      payload: {
        envelopeXdr: paymentXdr("1"),
        policyId: "strict",
        knownDestinations: [DEST.publicKey()],
      },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ recommendation: "sign", policy: { verdict: "allow" } });

    const denied = await app.inject({
      method: "POST",
      url: "/api/v1/inspect",
      payload: { envelopeXdr: paymentXdr("50"), policyId: "strict" },
    });
    expect(denied.json()).toMatchObject({ recommendation: "reject", policy: { verdict: "deny" } });
    expect(denied.json().policy.violations[0].code).toBe("MAX_AMOUNT_EXCEEDED");
  });

  it("accepts inline policies and rejects ambiguous requests", async () => {
    const inline = await app.inject({
      method: "POST",
      url: "/api/v1/inspect",
      payload: {
        envelopeXdr: paymentXdr("1"),
        policy: { version: 1, name: "inline", rules: { required_memo: true } },
      },
    });
    expect(inline.json().policy.violations[0].code).toBe("MEMO_MISSING");

    const both = await app.inject({
      method: "POST",
      url: "/api/v1/inspect",
      payload: {
        envelopeXdr: paymentXdr("1"),
        policyId: "strict",
        policy: { version: 1, name: "x", rules: {} },
      },
    });
    expect(both.statusCode).toBe(400);
  });

  it("returns INVALID_XDR with a request id for garbage input", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/inspect",
      payload: { envelopeXdr: "garbage", policyId: "strict" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatchObject({ code: "INVALID_XDR" });
    expect(res.json().error.requestId).toBeTruthy();
  });

  it("serves OpenAPI", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/openapi.json" });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(["/health", "/ready", "/api/v1/inspect", "/api/v1/policies"]),
    );
  });
});
