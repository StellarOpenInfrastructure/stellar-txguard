# Security overview

## What TxGuard protects

- Funds controlled by keys that sign transactions _after_ TxGuard approves them.
- Policy integrity: a policy must not be bypassable by crafting a transaction.

## What TxGuard does not do

- It does not hold keys, sign, or submit.
- It does not guarantee execution outcome; simulation is advisory.
- It does not authenticate callers in this scaffold.

## Trust assumptions

| Component                 | Trusted for                                                     |
| ------------------------- | --------------------------------------------------------------- |
| Stellar RPC endpoint      | correct simulation results and ledger height                    |
| Horizon endpoint          | correct account balances/thresholds (only used by `getAccount`) |
| Policy files / policy API | authored by operators; the API must be network-restricted       |
| Caller                    | supplies honest `knownDestinations` / `knownContracts`          |

## Attack surfaces

1. **Envelope parsing** — untrusted XDR is decoded by `@stellar/stellar-sdk`.
   Decoding errors map to `INVALID_XDR` (HTTP 400); bodies are capped at 512 KB
   and `envelopeXdr` at 200 000 characters.
2. **Policy evaluation** — rules are pure functions over parsed data. Amount
   arithmetic uses `bigint`; there is no floating point.
3. **Path payments** — evaluated at `sendMax` so a crafted path cannot exceed
   the limit.
4. **Soroban invocations** — only SEP-41 `transfer` is recognised as a value
   transfer. Other functions moving value (e.g. `transfer_from`, custom
   contracts) are _not_ captured by amount rules; use `contract_allowlist` and
   `simulation_required`. Extending coverage is a Drips Wave issue.
5. **HTTP API** — Helmet headers, CORS allowlist, request ids, schema
   validation, no auth (yet).
6. **Logging** — pino redaction of authorization/cookie/secret-like fields.
   Transaction XDR is never logged.

## Known gaps (tracked in docs/drips-wave.md)

- No API authentication or rate limiting.
- `InMemorySpendingLedger` is per-process; multi-instance deployments cannot
  enforce `daily_limit` correctly until a shared ledger exists.
- Muxed accounts (`M...`) are compared verbatim; a policy listing a `G...`
  address will not match its muxed variants.
- Fee-bump transactions: fee source spending is not counted against limits.
- Simulation auth entries are counted but not inspected.
