/**
 * Builds a sample payment and runs it through TxGuard in-process.
 * Usage: pnpm exec tsx scripts/inspect-example.ts [policy-file]
 */
import { readFileSync } from "node:fs";
import {
  Account,
  Asset,
  BASE_FEE,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { loadPolicyFromYaml, TxGuard } from "@stellar-txguard/core";

const policyFile = process.argv[2] ?? "examples/policies/default.yaml";
const policy = loadPolicyFromYaml(readFileSync(policyFile, "utf8"));

const source = Keypair.random();
const tx = new TransactionBuilder(new Account(source.publicKey(), "1"), {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.payment({
      destination: Keypair.random().publicKey(),
      asset: Asset.native(),
      amount: "1500",
    }),
  )
  .addMemo(Memo.text("invoice-1001"))
  .setTimeout(300)
  .build();

const guard = new TxGuard();
const report = await guard.inspect({
  envelopeXdr: tx.toXDR(),
  networkPassphrase: Networks.TESTNET,
  policy,
});
console.log(
  JSON.stringify(
    { recommendation: report.recommendation, policy: report.policy, risk: report.risk },
    null,
    2,
  ),
);
