# API reference

The API is versioned under `/api/v1`. The authoritative contract is the
generated OpenAPI 3.1 document in [`openapi.json`](openapi.json), served live at
`/api/v1/openapi.json` and rendered at `/docs`.

## Conventions

- JSON request and response bodies.
- Every response has an `x-request-id` header; send your own to correlate logs.
- Errors: `{ "error": { "code": string, "message": string, "requestId": string, "details"?: unknown } }`.

| HTTP | `code`              | When                                                         |
| ---- | ------------------- | ------------------------------------------------------------ |
| 400  | `VALIDATION_ERROR`  | body/params failed schema validation (`details` lists paths) |
| 400  | `INVALID_XDR`       | envelope could not be decoded                                |
| 400  | `INVALID_POLICY`    | inline policy failed validation                              |
| 404  | `POLICY_NOT_FOUND`  | unknown `policyId`                                           |
| 409  | `POLICY_EXISTS`     | duplicate policy id on create                                |
| 422  | `SIMULATION_FAILED` | reserved for strict simulation mode                          |
| 503  | `RPC_UNAVAILABLE`   | Stellar RPC could not be reached                             |
| 500  | `INTERNAL`          | unexpected error (logged with request id)                    |

## `POST /api/v1/inspect`

Request:

```json
{
  "envelopeXdr": "AAAAAgAAAAA...",
  "networkPassphrase": "Test SDF Network ; September 2015",
  "policyId": "default",
  "skipSimulation": false,
  "knownDestinations": ["GABC..."],
  "knownContracts": ["CABC..."]
}
```

Exactly one of `policyId` or `policy` (inline policy object) is required.

Response: an `InspectionReport`:

```json
{
  "recommendation": "sign | review | reject",
  "transaction": { "hash": "…", "source": "G…", "operations": [ { "index": 0, "type": "payment", "transfers": [ … ] } ], "isSoroban": false, "…": "…" },
  "policy": { "verdict": "allow", "policyName": "default", "violations": [], "skipped": [], "evaluatedAt": "…" },
  "simulation": { "status": "success", "minResourceFee": "…", "resources": { … } },
  "risk": { "score": 5, "level": "low", "signals": [ { "id": "MISSING_MEMO", "weight": 5, "message": "…" } ] }
}
```

`recommendation` is derived as: policy `deny` → `reject`; policy `review` →
`review`; otherwise `review` if risk level ≥ `REVIEW_AT_RISK_LEVEL`, else `sign`.

## Policies

`GET /api/v1/policies`, `GET /api/v1/policies/:id`, `POST /api/v1/policies`.
Policy schema is documented in [`../guides/policies.md`](../guides/policies.md).
In this scaffold policies created via the API are held in memory.
