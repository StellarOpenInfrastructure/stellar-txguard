# Writing policies

A policy is a YAML (or JSON) document:

```yaml
version: 1
name: usdc-payouts
description: optional free text
on_violation: deny # or "review"
rules:
  max_amount:
    - asset: native # asset selector, see below
      amount: "1000"
    - asset: "*"
      amount: "25000"
  allowed_assets: ["native", "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"]
  blocked_assets: ["SCAM:G..."]
  allowed_destinations: ["G...", "G..."]
  required_memo: true # or { types: [id, text] }
  simulation_required: true
  contract_allowlist: ["C..."]
  daily_limit:
    - asset: native
      amount: "5000"
```

## Asset selectors

| Selector        | Matches                                                                                |
| --------------- | -------------------------------------------------------------------------------------- |
| `native`        | XLM                                                                                    |
| `CODE:ISSUER`   | a classic issued asset                                                                 |
| `contract:C...` | a Soroban token by contract id                                                         |
| `*`             | any asset (allowed in `max_amount`, `daily_limit`, `allowed_assets`, `blocked_assets`) |

Amounts for classic assets are decimal strings with up to 7 fractional digits.
Amounts for `contract:` assets are **integers in the token's own units**
(TxGuard does not know a token's decimals). A wildcard decimal limit applied to
a contract asset produces a `MAX_AMOUNT_UNCOMPARABLE` violation rather than
silently passing.

## Rule semantics

| Rule                   | Violation codes                                       | Notes                                                                  |
| ---------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `max_amount`           | `MAX_AMOUNT_EXCEEDED`, `MAX_AMOUNT_UNCOMPARABLE`      | sums all transfers of the asset in the transaction                     |
| `blocked_assets`       | `ASSET_BLOCKED`                                       | evaluated before `allowed_assets`                                      |
| `allowed_assets`       | `ASSET_NOT_ALLOWED`                                   | only applies to transfers                                              |
| `allowed_destinations` | `DESTINATION_NOT_ALLOWED`                             | per transfer                                                           |
| `required_memo`        | `MEMO_MISSING`, `MEMO_TYPE_NOT_ALLOWED`               |                                                                        |
| `simulation_required`  | `SIMULATION_MISSING`, `SIMULATION_FAILED`             | Soroban transactions only                                              |
| `contract_allowlist`   | `CONTRACT_NOT_ALLOWED`, `CONTRACT_DEPLOY_NOT_ALLOWED` | deployments/uploads are never allowed when set                         |
| `daily_limit`          | `DAILY_LIMIT_EXCEEDED`                                | rolling 24h; skipped (reported) when no `SpendingLedger` is configured |

## What is _not_ a transfer

`manageSellOffer`, `changeTrust`, `setOptions`, `accountMerge` and other
operations do not produce transfers, so amount and destination rules do not
apply to them. Use the risk engine (`SENSITIVE_OPERATION`) or add a rule (see
`docs/drips-wave.md`, "operation_allowlist").

## Testing a policy

```bash
pnpm exec tsx scripts/inspect-example.ts examples/policies/usdc-payouts.yaml
```
