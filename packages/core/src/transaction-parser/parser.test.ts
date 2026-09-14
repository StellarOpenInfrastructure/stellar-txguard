import { describe, expect, it } from "vitest";
import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Keypair,
  Memo,
  nativeToScVal,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { parseTransaction } from "./parser.js";
import { TxGuardError } from "../errors.js";
import { buildTx, DEST, PASSPHRASE, SOURCE, USDC } from "../test-support/fixtures.js";

describe("parseTransaction", () => {
  it("parses a native payment", () => {
    const parsed = parseTransaction(buildTx(), PASSPHRASE);
    expect(parsed.source).toBe(SOURCE.publicKey());
    expect(parsed.operations).toHaveLength(1);
    const op = parsed.operations[0]!;
    expect(op.type).toBe("payment");
    expect(op.transfers).toEqual([
      { destination: DEST.publicKey(), asset: { type: "native", code: "XLM" }, amount: "10" },
    ]);
    expect(parsed.isSoroban).toBe(false);
    expect(parsed.signatureCount).toBe(1);
    expect(parsed.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.timeBounds?.maxTime).not.toBe("0");
  });

  it("parses issued asset payments and memos", () => {
    const xdr = buildTx({
      ops: [Operation.payment({ destination: DEST.publicKey(), asset: USDC, amount: "12.5" })],
      memo: Memo.text("invoice-42"),
    });
    const parsed = parseTransaction(xdr, PASSPHRASE);
    expect(parsed.memo).toEqual({ type: "text", value: "invoice-42" });
    expect(parsed.operations[0]!.transfers[0]!.asset).toEqual({
      type: "credit_alphanum4",
      code: "USDC",
      issuer: USDC.getIssuer(),
    });
  });

  it("uses sendMax for strict-receive path payments", () => {
    const xdr = buildTx({
      ops: [
        Operation.pathPaymentStrictReceive({
          sendAsset: Asset.native(),
          sendMax: "100",
          destination: DEST.publicKey(),
          destAsset: USDC,
          destAmount: "50",
          path: [],
        }),
      ],
    });
    const parsed = parseTransaction(xdr, PASSPHRASE);
    expect(parsed.operations[0]!.transfers[0]!.amount).toBe("100");
  });

  it("reports operations without transfers", () => {
    const xdr = buildTx({ ops: [Operation.setOptions({ homeDomain: "example.com" })] });
    const parsed = parseTransaction(xdr, PASSPHRASE);
    expect(parsed.operations[0]!.type).toBe("setOptions");
    expect(parsed.operations[0]!.transfers).toEqual([]);
  });

  it("parses fee bump envelopes", () => {
    const inner = TransactionBuilder.fromXDR(buildTx(), PASSPHRASE);
    const feeSource = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 9));
    const bump = TransactionBuilder.buildFeeBumpTransaction(
      feeSource,
      "1000",
      inner as never,
      PASSPHRASE,
    );
    bump.sign(feeSource);
    const parsed = parseTransaction(bump.toXDR(), PASSPHRASE);
    expect(parsed.feeBump).toEqual({ feeSource: feeSource.publicKey(), fee: "2000" }); // base fee × (ops + 1)
    expect(parsed.source).toBe(SOURCE.publicKey());
  });

  it("parses a Soroban contract invocation", () => {
    const contractId = StrKey.encodeContract(Buffer.alloc(32, 7));
    const account = new Account(SOURCE.publicKey(), "1");
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.invokeContractFunction({ contract: contractId, function: "hello", args: [] }),
      )
      .setTimeout(30)
      .build();
    const parsed = parseTransaction(tx.toXDR(), PASSPHRASE);
    expect(parsed.isSoroban).toBe(true);
    expect(parsed.operations[0]!.contract).toEqual({
      contractId,
      functionName: "hello",
      hostFunctionType: "invoke_contract",
    });
  });

  it("throws INVALID_XDR on garbage", () => {
    expect(() => parseTransaction("not-xdr", PASSPHRASE)).toThrowError(TxGuardError);
    try {
      parseTransaction("not-xdr", PASSPHRASE);
    } catch (err) {
      expect((err as TxGuardError).code).toBe("INVALID_XDR");
    }
  });
});

describe("Soroban token transfers", () => {
  it("extracts SEP-41 transfer(from, to, amount) as a transfer", () => {
    const contractId = StrKey.encodeContract(Buffer.alloc(32, 7));
    const tx = new TransactionBuilder(new Account(SOURCE.publicKey(), "1"), {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: "transfer",
          args: [
            new Address(SOURCE.publicKey()).toScVal(),
            new Address(DEST.publicKey()).toScVal(),
            nativeToScVal(1_000_000n, { type: "i128" }),
          ],
        }),
      )
      .setTimeout(30)
      .build();
    const parsed = parseTransaction(tx.toXDR(), PASSPHRASE);
    expect(parsed.operations[0]!.transfers).toEqual([
      { destination: DEST.publicKey(), asset: { type: "contract", contractId }, amount: "1000000" },
    ]);
  });
});
