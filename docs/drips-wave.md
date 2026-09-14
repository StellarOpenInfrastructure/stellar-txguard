# Drips Wave issue roadmap — stellar-txguard

This backlog turns the scaffold into a production-ready transaction firewall.
Issues are grouped by complexity for Drips Wave sprints; each can be picked up
independently. Security-relevant issues require review from a maintainer with
the security role (see the organization's GOVERNANCE.md).

## How to use this file

Maintainers copy an entry below into a GitHub issue using the **Drips Wave task** template, apply the `wave` label plus the complexity label, and add the `area:*` label. Contributors claim an issue by commenting on it. Every entry is independently actionable: none depends on another entry being finished first unless stated in _Technical notes_.

| Complexity | Label          | Expected points | Typical effort        |
| ---------- | -------------- | --------------- | --------------------- |
| Trivial    | `wave-trivial` | 2               | a few hours           |
| Medium     | `wave-medium`  | 5               | 1–3 days              |
| High       | `wave-high`    | 10              | up to one sprint week |

Totals: **11 trivial**, **11 medium**, **5 high**.

## Index

### Trivial

1. [Add a policy cookbook with five worked examples](#1-add-a-policy-cookbook-with-five-worked-examples) — `area:docs`
2. [Test that every example policy in examples/policies validates](#2-test-that-every-example-policy-in-examplespolicies-validates) — `area:docs`
3. [Improve MAX_AMOUNT_EXCEEDED message with operation breakdown](#3-improve-maxamountexceeded-message-with-operation-breakdown) — `area:backend`
4. [Add `operationTypes` summary to ParsedTransaction](#4-add-operationtypes-summary-to-parsedtransaction) — `area:sdk`
5. [Return 415 for non-JSON content types on POST routes](#5-return-415-for-non-json-content-types-on-post-routes) — `area:backend`
6. [Add `make check` target that runs lint, typecheck, test and build](#6-add-make-check-target-that-runs-lint-typecheck-test-and-build) — `area:devops`
7. [Document the InspectionReport type field by field](#7-document-the-inspectionreport-type-field-by-field) — `area:docs`
8. [Add a `--json` flag and exit codes to the inspect example script](#8-add-a---json-flag-and-exit-codes-to-the-inspect-example-script) — `area:sdk`
9. [Add NO_TIME_BOUNDS heuristic unit tests and message polish](#9-add-notimebounds-heuristic-unit-tests-and-message-polish) — `area:backend`
10. [Add Prettier and ESLint editor recommendations](#10-add-prettier-and-eslint-editor-recommendations) — `area:devops`
11. [Validate Stellar addresses with checksum in policy schema](#11-validate-stellar-addresses-with-checksum-in-policy-schema) — `area:security`

### Medium

12. [PostgreSQL-backed SpendingLedger](#12-postgresql-backed-spendingledger) — `area:backend`
13. [Persist policies in PostgreSQL with versioning](#13-persist-policies-in-postgresql-with-versioning) — `area:backend`
14. [API-key authentication with per-key policy restrictions](#14-api-key-authentication-with-per-key-policy-restrictions) — `area:security`
15. [Rate limiting per API key and per IP](#15-rate-limiting-per-api-key-and-per-ip) — `area:security`
16. [Live-RPC simulation integration test suite (opt-in)](#16-live-rpc-simulation-integration-test-suite-opt-in) — `area:devops`
17. [Recognise more Soroban token functions as transfers](#17-recognise-more-soroban-token-functions-as-transfers) — `area:sdk`
18. [Inspect Soroban authorization entries](#18-inspect-soroban-authorization-entries) — `area:security`
19. [Muxed account and fee-source handling in policies](#19-muxed-account-and-fee-source-handling-in-policies) — `area:sdk`
20. [`operation_allowlist` and `operation_blocklist` rules](#20-operationallowlist-and-operationblocklist-rules) — `area:backend`
21. [SDK retry, timeout and idempotency support](#21-sdk-retry-timeout-and-idempotency-support) — `area:sdk`
22. [Prometheus metrics endpoint](#22-prometheus-metrics-endpoint) — `area:devops`

### High

23. [Policy dashboard (Next.js) for authoring and testing policies](#23-policy-dashboard-nextjs-for-authoring-and-testing-policies) — `area:frontend`
24. [Rust core crate for embedding TxGuard in signers](#24-rust-core-crate-for-embedding-txguard-in-signers) — `area:sdk`
25. [Multi-policy evaluation and policy composition](#25-multi-policy-evaluation-and-policy-composition) — `area:backend`
26. [Signed inspection receipts](#26-signed-inspection-receipts) — `area:security`
27. [Velocity and behavioural risk heuristics with pluggable history provider](#27-velocity-and-behavioural-risk-heuristics-with-pluggable-history-provider) — `area:backend`

## Trivial issues

### 1. Add a policy cookbook with five worked examples

- **Complexity:** Trivial (`wave-trivial`)
- **Expected points:** 2
- **Area:** `area:docs`

**Problem**

New users need to see complete policies for common situations (payout service, treasury, dApp backend, exchange hot wallet, anchor). The guide currently documents rule semantics but not end-to-end examples.

**Scope**

Add `docs/guides/policy-cookbook.md` with five complete, valid YAML policies and a paragraph each explaining the intent. Add the files under `examples/policies/` and make sure `PolicyStore.fromDirectory` loads them.

**Acceptance criteria**

- [ ] Five new policy files under examples/policies/ load without validation errors
- [ ] Cookbook page links each example and explains every rule used
- [ ] README links to the cookbook

**Technical notes**

Validate each file with `loadPolicyFromYaml` in a test that iterates over `examples/policies/*.yaml`.

**Files likely affected**

- `docs/guides/policy-cookbook.md`
- `examples/policies/*.yaml`
- `packages/core/src/policy-engine/examples.test.ts`
- `README.md`

**Tests required**

A test that loads every example policy and asserts it validates.

**Documentation required**

The cookbook page itself plus a README link.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 2. Test that every example policy in examples/policies validates

- **Complexity:** Trivial (`wave-trivial`)
- **Expected points:** 2
- **Area:** `area:docs`

**Problem**

Example policies can silently drift from the schema when rules change; nothing checks them today.

**Scope**

Add a vitest test in core that globs `examples/policies/*.yaml`, parses each with `loadPolicyFromYaml` and asserts success. Keep the test in the core package with a relative path to the repo root.

**Acceptance criteria**

- [ ] Test fails if any example policy is invalid
- [ ] Test is included in `make test`

**Technical notes**

Use `node:fs` `readdirSync` with `fileURLToPath(import.meta.url)` to locate the repo root; do not add a glob dependency.

**Files likely affected**

- `packages/core/src/policy-engine/examples.test.ts`

**Tests required**

The test itself.

**Documentation required**

None beyond a line in CONTRIBUTING.md that example policies are tested.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 3. Improve MAX_AMOUNT_EXCEEDED message with operation breakdown

- **Complexity:** Trivial (`wave-trivial`)
- **Expected points:** 2
- **Area:** `area:backend`

**Problem**

When a limit is exceeded across several operations the message only reports the total, so operators cannot see which operations contributed.

**Scope**

Extend the `max_amount` rule to include a `context.operations` string listing `index:amount` pairs for the offending asset.

**Acceptance criteria**

- [ ] Violation context includes the per-operation breakdown
- [ ] Existing tests still pass; a new test covers a two-operation breach

**Technical notes**

Keep `context` values as strings; the API schema only allows string/number/boolean.

**Files likely affected**

- `packages/core/src/policy-engine/rules.ts`
- `packages/core/src/policy-engine/engine.test.ts`

**Tests required**

Unit test for the breakdown content.

**Documentation required**

Update the rule table in docs/guides/policies.md.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 4. Add `operationTypes` summary to ParsedTransaction

- **Complexity:** Trivial (`wave-trivial`)
- **Expected points:** 2
- **Area:** `area:sdk`

**Problem**

Consumers often just want to know which operation types a transaction contains without iterating operations.

**Scope**

Add a derived `operationTypes: string[]` (unique, in first-seen order) to `ParsedTransaction` and to the API response schema.

**Acceptance criteria**

- [ ] Field present in parser output and in `report-schema.ts`
- [ ] OpenAPI regenerated

**Technical notes**

Populate in `parseTransaction`; keep it deterministic.

**Files likely affected**

- `packages/core/src/transaction-parser/types.ts`
- `packages/core/src/transaction-parser/parser.ts`
- `backend/src/report-schema.ts`
- `docs/api/openapi.json`

**Tests required**

Parser unit test.

**Documentation required**

docs/api/README.md response example.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 5. Return 415 for non-JSON content types on POST routes

- **Complexity:** Trivial (`wave-trivial`)
- **Expected points:** 2
- **Area:** `area:backend`

**Problem**

Sending `text/plain` to `/api/v1/inspect` yields a generic Fastify error rather than the documented error envelope.

**Scope**

Map Fastify's unsupported-media-type error (`FST_ERR_CTP_INVALID_MEDIA_TYPE`) to `{ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } }` with status 415 in `errorHandler`.

**Acceptance criteria**

- [ ] Integration test asserts 415 and the error envelope
- [ ] docs/api/README.md lists the code

**Technical notes**

Check `err.code` in `backend/src/errors.ts`.

**Files likely affected**

- `backend/src/errors.ts`
- `backend/src/app.test.ts`
- `docs/api/README.md`

**Tests required**

Integration test via `app.inject`.

**Documentation required**

Error table in docs/api/README.md.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 6. Add `make check` target that runs lint, typecheck, test and build

- **Complexity:** Trivial (`wave-trivial`)
- **Expected points:** 2
- **Area:** `area:devops`

**Problem**

Contributors run four commands before pushing; CI runs the same four. A single target reduces mistakes.

**Scope**

Add `check` to the Makefile and mention it in CONTRIBUTING.md.

**Acceptance criteria**

- [ ] `make check` runs lint, typecheck, test, build in that order and stops on first failure

**Technical notes**

Use Make prerequisites rather than a shell chain.

**Files likely affected**

- `Makefile`
- `CONTRIBUTING.md`

**Tests required**

None (tooling).

**Documentation required**

CONTRIBUTING.md quick start.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 7. Document the InspectionReport type field by field

- **Complexity:** Trivial (`wave-trivial`)
- **Expected points:** 2
- **Area:** `area:docs`

**Problem**

The API reference shows an abbreviated example; integrators need every field explained, including when `simulation` is absent.

**Scope**

Add `docs/api/inspection-report.md` describing each field of `InspectionReport`, `ParsedTransaction`, `PolicyDecision`, `SimulationResult` and `RiskAssessment`.

**Acceptance criteria**

- [ ] Every field in `report-schema.ts` is documented
- [ ] Linked from docs/api/README.md

**Technical notes**

Generate the field list from `backend/src/report-schema.ts` to avoid omissions.

**Files likely affected**

- `docs/api/inspection-report.md`
- `docs/api/README.md`

**Tests required**

None.

**Documentation required**

The new page.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 8. Add a `--json` flag and exit codes to the inspect example script

- **Complexity:** Trivial (`wave-trivial`)
- **Expected points:** 2
- **Area:** `area:sdk`

**Problem**

`scripts/inspect-example.ts` prints a report but always exits 0, so it cannot be used in shell pipelines.

**Scope**

Accept an XDR argument and a `--json` flag; exit 0 for `sign`, 2 for `review`, 3 for `reject`, 1 for errors.

**Acceptance criteria**

- [ ] Script usage documented in its header
- [ ] Exit codes behave as specified

**Technical notes**

Parse args manually; do not add a CLI dependency for this script.

**Files likely affected**

- `scripts/inspect-example.ts`
- `docs/guides/quickstart.md`

**Tests required**

A shell snippet in docs; no automated test required.

**Documentation required**

Quickstart guide.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 9. Add NO_TIME_BOUNDS heuristic unit tests and message polish

- **Complexity:** Trivial (`wave-trivial`)
- **Expected points:** 2
- **Area:** `area:backend`

**Problem**

The `noTimeBounds` heuristic fires for `maxTime === '0'` but has no dedicated test, and its message is unclear to non-experts.

**Scope**

Add tests for absent bounds, `maxTime: 0` and a proper bound; reword the message to explain the replay risk.

**Acceptance criteria**

- [ ] Three unit tests covering the cases
- [ ] Message mentions that the transaction can be submitted at any time in the future

**Technical notes**

See `packages/core/src/risk-engine/heuristics.ts`.

**Files likely affected**

- `packages/core/src/risk-engine/heuristics.ts`
- `packages/core/src/risk-engine/engine.test.ts`

**Tests required**

The unit tests.

**Documentation required**

None.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 10. Add Prettier and ESLint editor recommendations

- **Complexity:** Trivial (`wave-trivial`)
- **Expected points:** 2
- **Area:** `area:devops`

**Problem**

Contributors using VS Code get inconsistent formatting until they discover the configs.

**Scope**

Add `.vscode/extensions.json` recommending ESLint and Prettier, and `.vscode/settings.json` with format-on-save scoped to this workspace.

**Acceptance criteria**

- [ ] Files exist, are committed, and are excluded from `.gitignore` rules

**Technical notes**

`.gitignore` currently ignores `.vscode/*` except `extensions.json`; adjust it.

**Files likely affected**

- `.vscode/extensions.json`
- `.vscode/settings.json`
- `.gitignore`

**Tests required**

None.

**Documentation required**

One line in CONTRIBUTING.md.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 11. Validate Stellar addresses with checksum in policy schema

- **Complexity:** Trivial (`wave-trivial`)
- **Expected points:** 2
- **Area:** `area:security`

**Problem**

The policy schema checks addresses with a regex only; an address with a bad checksum passes validation and can never match.

**Scope**

Use `StrKey.isValidEd25519PublicKey` / `isValidContract` in Zod refinements for `allowed_destinations` and `contract_allowlist`.

**Acceptance criteria**

- [ ] A policy with a bad-checksum address fails validation with a clear message
- [ ] Existing example policies still validate

**Technical notes**

Core already depends on `@stellar/stellar-sdk`.

**Files likely affected**

- `packages/core/src/policy-engine/schema.ts`
- `packages/core/src/policy-engine/engine.test.ts`

**Tests required**

Unit tests for valid/invalid checksums.

**Documentation required**

Mention in docs/guides/policies.md.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

## Medium issues

### 12. PostgreSQL-backed SpendingLedger

- **Complexity:** Medium (`wave-medium`)
- **Expected points:** 5
- **Area:** `area:backend`

**Problem**

`daily_limit` only works within one process because the ledger is in memory. Multi-instance deployments cannot enforce it.

**Scope**

Add `backend/src/ledger/postgres-ledger.ts` implementing `SpendingLedger` with a `spending` table (account, asset_key, units, at). Provide a migration under `database/migrations`, wire it in via `DATABASE_URL`, and add a `postgres` service to docker-compose.

**Acceptance criteria**

- [ ] Implements `spentInWindow` and `record` with correct window semantics
- [ ] Migration is idempotent and documented
- [ ] Falls back to in-memory when `DATABASE_URL` is unset
- [ ] Integration test runs against a Postgres container in CI (service container)

**Technical notes**

Use the `postgres` npm package; store units as `NUMERIC(39,0)` and convert to `bigint`. Index on (account, asset_key, at).

**Files likely affected**

- `backend/src/ledger/postgres-ledger.ts`
- `backend/src/config.ts`
- `backend/src/app.ts`
- `database/migrations/0001_spending.sql`
- `docker-compose.yml`
- `.github/workflows/ci.yml`

**Tests required**

Integration test with a real Postgres (CI service) covering window boundaries.

**Documentation required**

docs/architecture/overview.md (data flow) and README configuration table.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 13. Persist policies in PostgreSQL with versioning

- **Complexity:** Medium (`wave-medium`)
- **Expected points:** 5
- **Area:** `area:backend`

**Problem**

Policies created through the API vanish on restart and have no history.

**Scope**

Add a `policies` table (id, version, document JSONB, created_at, created_by) and a `PostgresPolicyStore` with the same interface as `PolicyStore`. Creating a policy with an existing id inserts a new version; `GET /policies/:id` returns the latest and `GET /policies/:id/versions` lists history.

**Acceptance criteria**

- [ ] Store interface extracted so both implementations are interchangeable
- [ ] Versions endpoint documented in OpenAPI
- [ ] Startup imports `POLICY_DIR` files only if the table is empty

**Technical notes**

Depends on the same `DATABASE_URL` plumbing as the ledger issue but can be built independently by adding the migration file.

**Files likely affected**

- `backend/src/policy-store.ts`
- `backend/src/policy-store-postgres.ts`
- `backend/src/routes/policies.ts`
- `database/migrations/0002_policies.sql`

**Tests required**

Integration tests for versioning semantics.

**Documentation required**

docs/api/README.md.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 14. API-key authentication with per-key policy restrictions

- **Complexity:** Medium (`wave-medium`)
- **Expected points:** 5
- **Area:** `area:security`

**Problem**

The API is unauthenticated; anyone reaching it can create policies or inspect with an inline policy.

**Scope**

Add an `API_KEYS` env var (comma-separated `keyId:sha256hash`), a Fastify `onRequest` hook that verifies `Authorization: Bearer`, and an optional per-key allowlist of policy ids. Health endpoints stay public.

**Acceptance criteria**

- [ ] Requests without a valid key get 401 with the standard error envelope
- [ ] Keys are compared in constant time and never logged
- [ ] SDK already sends the header; document it

**Technical notes**

Store only hashes in the environment. Use `crypto.timingSafeEqual`.

**Files likely affected**

- `backend/src/auth.ts`
- `backend/src/app.ts`
- `backend/src/config.ts`
- `.env.example`
- `docs/security/overview.md`

**Tests required**

Integration tests for missing, invalid and valid keys.

**Documentation required**

README Security section and .env.example.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 15. Rate limiting per API key and per IP

- **Complexity:** Medium (`wave-medium`)
- **Expected points:** 5
- **Area:** `area:security`

**Problem**

A single client can overload simulation by spamming `/inspect`.

**Scope**

Add `@fastify/rate-limit` keyed by API key when present, else IP, with limits configurable via env. Return 429 with `RATE_LIMITED` in the error envelope.

**Acceptance criteria**

- [ ] Limits configurable and documented
- [ ] 429 uses the standard envelope
- [ ] Health endpoints exempt

**Technical notes**

Use the in-memory store by default; document Redis as an option.

**Files likely affected**

- `backend/src/app.ts`
- `backend/src/config.ts`
- `backend/src/errors.ts`
- `docs/api/README.md`

**Tests required**

Integration test that exceeds the limit.

**Documentation required**

docs/api/README.md error table.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 16. Live-RPC simulation integration test suite (opt-in)

- **Complexity:** Medium (`wave-medium`)
- **Expected points:** 5
- **Area:** `area:devops`

**Problem**

`RpcSimulator` is untested against a real network; regressions in SDK response shapes go unnoticed.

**Scope**

Add `tests/live/simulation.live.test.ts` that builds a Soroban invocation against a known testnet contract and asserts a successful `SimulationResult`. Run only when `LIVE_TESTS=1`; add a scheduled CI job.

**Acceptance criteria**

- [ ] Test is skipped by default
- [ ] Scheduled workflow runs it weekly and reports failures
- [ ] Deploys or uses an existing public testnet contract, documented

**Technical notes**

Use the SAC for native XLM on testnet to avoid deploying anything. Handle testnet resets gracefully (skip with a warning).

**Files likely affected**

- `tests/live/simulation.live.test.ts`
- `vitest.config.ts`
- `.github/workflows/live.yml`

**Tests required**

The live test itself.

**Documentation required**

docs/guides/testing.md (new).

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 17. Recognise more Soroban token functions as transfers

- **Complexity:** Medium (`wave-medium`)
- **Expected points:** 5
- **Area:** `area:sdk`

**Problem**

Only `transfer(from, to, amount)` is extracted. `transfer_from`, `burn`, `mint`, `approve` and SAC-specific calls move or authorise value and are invisible to amount rules.

**Scope**

Extend `parseInvokeHostFunction` to map SEP-41 `transfer_from`, `burn`, `burn_from`, `mint` and `approve` into transfers (or a new `approvals` list for `approve`). Keep the mapping table data-driven.

**Acceptance criteria**

- [ ] Each function has a fixture-based test
- [ ] `approve` is exposed distinctly so policies can forbid unlimited approvals

**Technical notes**

Amounts are `i128`; use `scValToNative`. Add `approvals?: { spender, amount, expirationLedger }[]` to `ParsedOperation`.

**Files likely affected**

- `packages/core/src/transaction-parser/parser.ts`
- `packages/core/src/transaction-parser/types.ts`
- `packages/core/src/transaction-parser/parser.test.ts`
- `backend/src/report-schema.ts`

**Tests required**

Unit tests per function.

**Documentation required**

docs/security/overview.md attack surface #4 and docs/guides/policies.md.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 18. Inspect Soroban authorization entries

- **Complexity:** Medium (`wave-medium`)
- **Expected points:** 5
- **Area:** `area:security`

**Problem**

Simulation reports how many auth entries a transaction needs but not what they authorise; a policy cannot forbid invoking an unexpected sub-contract.

**Scope**

Parse `SorobanAuthorizationEntry` trees from the simulation result into a list of `{ invoker, contractId, functionName }` and add a `contract_allowlist`-style check over sub-invocations (`allowed_sub_invocations`).

**Acceptance criteria**

- [ ] `SimulationResult.authEntries` populated
- [ ] New rule with tests
- [ ] Unknown sub-invocations produce `SUB_INVOCATION_NOT_ALLOWED`

**Technical notes**

Walk `rootInvocation.subInvocations` recursively; cap depth at 16.

**Files likely affected**

- `packages/core/src/simulation/rpc-simulator.ts`
- `packages/core/src/simulation/types.ts`
- `packages/core/src/policy-engine/schema.ts`
- `packages/core/src/policy-engine/rules.ts`

**Tests required**

Unit tests with hand-built auth entries.

**Documentation required**

docs/guides/policies.md rule table.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 19. Muxed account and fee-source handling in policies

- **Complexity:** Medium (`wave-medium`)
- **Expected points:** 5
- **Area:** `area:sdk`

**Problem**

Muxed destinations (`M...`) never match `allowed_destinations` entries written as `G...`, and fee-bump fee sources are ignored by limits.

**Scope**

Normalise muxed destinations to their base `G` address (keeping the id in a separate field) for matching, and count fee-bump fees toward `max_amount` for `native` when enabled via a policy flag `count_fees`.

**Acceptance criteria**

- [ ] A policy listing a `G` address matches its muxed variants
- [ ] Muxed id preserved in `PaymentLike.muxedId`
- [ ] Fee accounting is opt-in and tested

**Technical notes**

Use `MuxedAccount.fromAddress` from the SDK.

**Files likely affected**

- `packages/core/src/transaction-parser/parser.ts`
- `packages/core/src/transaction-parser/types.ts`
- `packages/core/src/policy-engine/rules.ts`
- `packages/core/src/policy-engine/schema.ts`

**Tests required**

Unit tests for muxed matching and fee counting.

**Documentation required**

docs/guides/policies.md and docs/security/overview.md known gaps.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 20. `operation_allowlist` and `operation_blocklist` rules

- **Complexity:** Medium (`wave-medium`)
- **Expected points:** 5
- **Area:** `area:backend`

**Problem**

Operators want to forbid whole operation types (e.g. `setOptions`, `accountMerge`) rather than rely on risk heuristics.

**Scope**

Add two rules over `ParsedOperation.type` with violation codes `OPERATION_NOT_ALLOWED` and `OPERATION_BLOCKED`. Validate names against the SDK's operation type list.

**Acceptance criteria**

- [ ] Rules validated, evaluated and documented
- [ ] Blocklist evaluated before allowlist

**Technical notes**

Follow the `blocked_assets`/`allowed_assets` pattern.

**Files likely affected**

- `packages/core/src/policy-engine/schema.ts`
- `packages/core/src/policy-engine/rules.ts`
- `packages/core/src/policy-engine/engine.test.ts`
- `docs/guides/policies.md`

**Tests required**

Unit tests for both rules.

**Documentation required**

Rule table.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 21. SDK retry, timeout and idempotency support

- **Complexity:** Medium (`wave-medium`)
- **Expected points:** 5
- **Area:** `area:sdk`

**Problem**

`TxGuardClient` fails immediately on transient network errors and has no idempotency for policy creation.

**Scope**

Add configurable retries with exponential backoff for idempotent requests (GET and `inspect`), and an `Idempotency-Key` header for `createPolicy`. Respect `Retry-After` on 429.

**Acceptance criteria**

- [ ] Retries only on network errors and 5xx/429
- [ ] `inspect` retries are safe because it has no side effects
- [ ] Backoff parameters documented

**Technical notes**

Keep the client dependency-free.

**Files likely affected**

- `packages/sdk/src/index.ts`
- `packages/sdk/src/client.test.ts`
- `README.md`

**Tests required**

Unit tests with a fetch mock failing then succeeding.

**Documentation required**

README SDK section.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 22. Prometheus metrics endpoint

- **Complexity:** Medium (`wave-medium`)
- **Expected points:** 5
- **Area:** `area:devops`

**Problem**

The API is 'metrics-ready' but exposes nothing; operators cannot see inspection counts or verdict distribution.

**Scope**

Add `GET /metrics` (Prometheus text format) with counters for inspections by recommendation, policy violations by code, simulation outcomes, and request latency histograms. Bind to the main port but allow disabling via env.

**Acceptance criteria**

- [ ] Metrics endpoint documented and excluded from OpenAPI
- [ ] No high-cardinality labels (no addresses, no request ids)

**Technical notes**

Use `prom-client`; register a Fastify `onResponse` hook.

**Files likely affected**

- `backend/src/metrics.ts`
- `backend/src/app.ts`
- `backend/src/config.ts`
- `docs/architecture/overview.md`

**Tests required**

Integration test that scrapes the endpoint after an inspection.

**Documentation required**

README Deployment and docs/architecture.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

## High issues

### 23. Policy dashboard (Next.js) for authoring and testing policies

- **Complexity:** High (`wave-high`)
- **Expected points:** 10
- **Area:** `area:frontend`

**Problem**

Policies are edited as YAML files with no feedback until the API loads them. Operators need a UI to author policies, validate them and dry-run transactions.

**Scope**

Create `frontend/` (Next.js, TypeScript, Tailwind) with pages: Policies (list/create/edit with live validation), Inspect (paste XDR, choose policy, view report), Settings (API base URL, key). Use the SDK. Include empty and loading states; no marketing content.

**Acceptance criteria**

- [ ] `pnpm --filter frontend dev` runs the dashboard against a local API
- [ ] Policy editor shows Zod validation errors inline
- [ ] Inspect page renders violations, risk signals and simulation resources
- [ ] Lint, typecheck and build in CI

**Technical notes**

Add the frontend to `pnpm-workspace.yaml` and a CI job. Keep the design minimal and accessible (keyboard navigation, labels).

**Files likely affected**

- `frontend/**`
- `pnpm-workspace.yaml`
- `.github/workflows/ci.yml`
- `README.md`

**Tests required**

Component tests for the policy editor validation and an e2e smoke test (Playwright) for the inspect flow.

**Documentation required**

docs/guides/dashboard.md and README Features/Architecture.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 24. Rust core crate for embedding TxGuard in signers

- **Complexity:** High (`wave-high`)
- **Expected points:** 10
- **Area:** `area:sdk`

**Problem**

Custody systems and HSM sidecars are often written in Rust and cannot embed a Node runtime.

**Scope**

Create `rust/txguard-core` implementing the transaction parser (via `stellar-xdr`), the policy schema (serde) and the pure rules (`max_amount`, `allowed_assets`, `blocked_assets`, `allowed_destinations`, `required_memo`, `contract_allowlist`). Share test fixtures with the TypeScript core so both produce identical decisions.

**Acceptance criteria**

- [ ] Crate builds with `cargo test` in CI
- [ ] Cross-language fixture tests prove identical verdicts for at least 20 transactions
- [ ] Published API documented with rustdoc

**Technical notes**

Skip simulation and daily_limit in the first iteration. Fixture format: JSON files under `tests/fixtures/decisions/` consumed by both suites.

**Files likely affected**

- `rust/txguard-core/**`
- `tests/fixtures/decisions/*.json`
- `.github/workflows/ci.yml`

**Tests required**

Rust unit tests and the cross-language fixture suite.

**Documentation required**

README (Rust section) and docs/architecture/overview.md.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 25. Multi-policy evaluation and policy composition

- **Complexity:** High (`wave-high`)
- **Expected points:** 10
- **Area:** `area:backend`

**Problem**

Organisations apply several policies at once (global limits plus per-team rules). Today a request uses exactly one policy.

**Scope**

Allow `policyIds: string[]` in `/inspect` and `TxGuard.inspect`. Evaluate all, merge violations, and derive the verdict as the strictest (`deny` > `review` > `allow`). Add `extends: <policyId>` in the policy schema for inheritance with explicit override semantics.

**Acceptance criteria**

- [ ] Merged decision lists which policy produced each violation
- [ ] Inheritance resolves cycles with a validation error
- [ ] OpenAPI and SDK updated

**Technical notes**

Add `policyId` to `Violation`. Resolve `extends` in the store, not in the engine.

**Files likely affected**

- `packages/core/src/policy-engine/**`
- `packages/core/src/inspector.ts`
- `backend/src/routes/inspect.ts`
- `packages/sdk/src/index.ts`
- `docs/guides/policies.md`

**Tests required**

Unit tests for merge/strictest semantics and inheritance cycles; integration tests for the API.

**Documentation required**

Policies guide and API reference.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 26. Signed inspection receipts

- **Complexity:** High (`wave-high`)
- **Expected points:** 10
- **Area:** `area:security`

**Problem**

Downstream signers cannot prove that a transaction was inspected and approved by a specific TxGuard instance and policy version.

**Scope**

Add an optional Ed25519 signing key (env, never logged) so the API returns `receipt: { txHash, policyId, policyVersion, recommendation, issuedAt, signature }`. Provide `verifyReceipt()` in the SDK and core.

**Acceptance criteria**

- [ ] Receipts verify with the published public key
- [ ] Receipts include the policy document hash
- [ ] Key absence disables receipts without error

**Technical notes**

Use `node:crypto` Ed25519; canonicalise JSON before signing (sorted keys). Public key exposed at `GET /api/v1/receipt-key`.

**Files likely affected**

- `backend/src/receipts.ts`
- `backend/src/routes/inspect.ts`
- `packages/core/src/receipts.ts`
- `packages/sdk/src/index.ts`
- `docs/security/receipts.md`

**Tests required**

Unit tests for sign/verify and tamper detection.

**Documentation required**

docs/security/receipts.md and README Security.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged

### 27. Velocity and behavioural risk heuristics with pluggable history provider

- **Complexity:** High (`wave-high`)
- **Expected points:** 10
- **Area:** `area:backend`

**Problem**

Risk scoring is stateless. Detecting unusual behaviour (sudden volume spike, new counterparties, off-hours activity) needs history.

**Scope**

Define a `HistoryProvider` interface (recent transactions per account) with an in-memory implementation and a Horizon/RPC-backed one. Add heuristics: `VOLUME_SPIKE` (24h volume vs 30-day median), `NEW_COUNTERPARTY_RATIO`, `OFF_HOURS` (configurable schedule).

**Acceptance criteria**

- [ ] Heuristics are individually configurable and can be disabled
- [ ] Horizon-backed provider is opt-in and documented as legacy
- [ ] Score contributions documented with rationale

**Technical notes**

Keep provider calls bounded (limit 200 records). Cache per account for 60 s.

**Files likely affected**

- `packages/core/src/risk-engine/history.ts`
- `packages/core/src/risk-engine/heuristics.ts`
- `packages/core/src/stellar-client/index.ts`
- `backend/src/app.ts`

**Tests required**

Unit tests with synthetic histories; one integration test with a static provider.

**Documentation required**

docs/architecture/overview.md and a new docs/guides/risk-heuristics.md.

**Definition of done**

- [ ] All acceptance criteria met
- [ ] Tests added and passing in CI (`make test`, `make lint`, `make build`)
- [ ] Documentation updated as listed above
- [ ] No secrets or credentials introduced
- [ ] PR reviewed and squash-merged
