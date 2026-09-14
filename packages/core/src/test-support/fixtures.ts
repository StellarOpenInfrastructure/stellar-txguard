import type { Memo } from "@stellar/stellar-sdk";
import {
  Account,
  Asset,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import type { Policy } from "../policy-engine/schema.js";

export const SOURCE = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1));
export const DEST = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2));
export const OTHER = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3));
export const ISSUER = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 4));
export const USDC = new Asset("USDC", ISSUER.publicKey());
export const USDC_KEY = `USDC:${ISSUER.publicKey()}`;
export const PASSPHRASE = Networks.TESTNET;

export interface BuildOptions {
  ops?: ReturnType<typeof Operation.payment>[];
  memo?: Memo;
  timeout?: number;
  sign?: boolean;
}

/** Build a signed (by default) payment transaction and return its XDR. */
export function buildTx(opts: BuildOptions = {}): string {
  const account = new Account(SOURCE.publicKey(), "1");
  const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE });
  const ops = opts.ops ?? [
    Operation.payment({ destination: DEST.publicKey(), asset: Asset.native(), amount: "10" }),
  ];
  for (const op of ops) builder.addOperation(op);
  if (opts.memo) builder.addMemo(opts.memo);
  builder.setTimeout(opts.timeout ?? 300);
  const tx = builder.build();
  if (opts.sign !== false) tx.sign(SOURCE);
  return tx.toXDR();
}

export function policy(
  rules: Policy["rules"],
  on_violation: Policy["on_violation"] = "deny",
): Policy {
  return { version: 1, name: "test", on_violation, rules };
}
