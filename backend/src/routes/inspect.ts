import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { policySchema, type TxGuard } from "@stellar-txguard/core";
import { HttpError } from "../errors.js";
import type { PolicyStore } from "../policy-store.js";
import { inspectionReportSchema } from "../report-schema.js";

const inspectBody = z
  .object({
    envelopeXdr: z.string().min(1).max(200_000),
    networkPassphrase: z.string().optional(),
    policyId: z.string().optional(),
    policy: policySchema.optional(),
    skipSimulation: z.boolean().optional(),
    knownDestinations: z.array(z.string()).max(10_000).optional(),
    knownContracts: z.array(z.string()).max(10_000).optional(),
  })
  .refine((b) => Boolean(b.policyId) !== Boolean(b.policy), {
    message: "exactly one of policyId or policy is required",
  });

export interface InspectDeps {
  guard: TxGuard;
  store: PolicyStore;
  defaultPassphrase: string;
}

export async function inspectRoutes(app: FastifyInstance, deps: InspectDeps): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.post(
    "/inspect",
    {
      schema: {
        tags: ["inspection"],
        summary: "Parse, simulate, policy-check and risk-score a transaction envelope",
        body: inspectBody,
        response: { 200: inspectionReportSchema },
      },
    },
    async (req) => {
      const body = req.body;
      const policy = body.policy ?? deps.store.get(body.policyId!);
      if (!policy)
        throw new HttpError(404, "POLICY_NOT_FOUND", `policy ${body.policyId} not found`);
      const report = await deps.guard.inspect({
        envelopeXdr: body.envelopeXdr,
        networkPassphrase: body.networkPassphrase ?? deps.defaultPassphrase,
        policy,
        ...(body.skipSimulation !== undefined ? { skipSimulation: body.skipSimulation } : {}),
        ...(body.knownDestinations ? { knownDestinations: new Set(body.knownDestinations) } : {}),
        ...(body.knownContracts ? { knownContracts: new Set(body.knownContracts) } : {}),
      });
      return report;
    },
  );
}
