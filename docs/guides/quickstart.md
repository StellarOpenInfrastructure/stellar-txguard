# Quickstart

```bash
git clone https://github.com/StellarOpenInfrastructure/stellar-txguard
cd stellar-txguard
make setup
cp .env.example .env
make dev
```

Open <http://localhost:4010/docs>.

Inspect a transaction with the example policy:

```bash
XDR=$(pnpm exec tsx -e '
import { Account, Asset, BASE_FEE, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
const k = Keypair.random();
const tx = new TransactionBuilder(new Account(k.publicKey(), "1"), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.payment({ destination: Keypair.random().publicKey(), asset: Asset.native(), amount: "5" }))
  .setTimeout(300).build();
console.log(tx.toXDR());')

curl -s localhost:4010/api/v1/inspect \
  -H 'content-type: application/json' \
  -d "{\"envelopeXdr\":\"$XDR\",\"policyId\":\"default\"}" | jq '{recommendation, violations: .policy.violations, risk: .risk.level}'
```

Expected: `recommendation: "reject"` with `MEMO_MISSING` (the default policy
requires a memo).
