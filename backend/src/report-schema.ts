import { z } from "zod";

/** Zod mirror of the core InspectionReport, used for response validation and OpenAPI. */
const assetRef = z.union([
  z.object({ type: z.literal("native"), code: z.literal("XLM") }),
  z.object({
    type: z.enum(["credit_alphanum4", "credit_alphanum12"]),
    code: z.string(),
    issuer: z.string(),
  }),
  z.object({ type: z.literal("contract"), contractId: z.string() }),
]);

const transfer = z.object({ destination: z.string(), asset: assetRef, amount: z.string() });

const operation = z.object({
  index: z.number().int(),
  type: z.string(),
  source: z.string().optional(),
  transfers: z.array(transfer),
  contract: z
    .object({
      contractId: z.string().optional(),
      functionName: z.string().optional(),
      hostFunctionType: z.enum(["invoke_contract", "create_contract", "upload_wasm"]),
    })
    .optional(),
});

export const parsedTransactionSchema = z.object({
  networkPassphrase: z.string(),
  hash: z.string(),
  source: z.string(),
  fee: z.string(),
  sequence: z.string(),
  memo: z.object({
    type: z.enum(["none", "text", "id", "hash", "return"]),
    value: z.string().optional(),
  }),
  timeBounds: z.object({ minTime: z.string(), maxTime: z.string() }).optional(),
  operations: z.array(operation),
  feeBump: z.object({ feeSource: z.string(), fee: z.string() }).optional(),
  isSoroban: z.boolean(),
  signatureCount: z.number().int(),
});

const violation = z.object({
  rule: z.string(),
  code: z.string(),
  message: z.string(),
  operationIndex: z.number().int().optional(),
  context: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const policyDecisionSchema = z.object({
  verdict: z.enum(["allow", "deny", "review"]),
  policyName: z.string(),
  violations: z.array(violation),
  skipped: z.array(z.object({ rule: z.string(), reason: z.string() })),
  evaluatedAt: z.string(),
});

export const simulationResultSchema = z.object({
  status: z.enum(["success", "error", "restore_required"]),
  error: z.string().optional(),
  minResourceFee: z.string().optional(),
  resources: z
    .object({
      cpuInstructions: z.number(),
      memoryBytes: z.number(),
      ledgerReadBytes: z.number(),
      ledgerWriteBytes: z.number(),
    })
    .optional(),
  authEntryCount: z.number().int().optional(),
  events: z.array(z.string()).optional(),
  latestLedger: z.number().int().optional(),
});

export const riskAssessmentSchema = z.object({
  score: z.number(),
  level: z.enum(["low", "medium", "high", "critical"]),
  signals: z.array(
    z.object({
      id: z.string(),
      weight: z.number(),
      message: z.string(),
      operationIndex: z.number().int().optional(),
    }),
  ),
});

export const inspectionReportSchema = z.object({
  transaction: parsedTransactionSchema,
  policy: policyDecisionSchema,
  simulation: simulationResultSchema.optional(),
  risk: riskAssessmentSchema,
  recommendation: z.enum(["sign", "review", "reject"]),
});
