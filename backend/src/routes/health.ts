import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { StellarClient } from "@stellar-txguard/core";

export interface HealthDeps {
  stellar?: StellarClient;
  version: string;
}

export async function healthRoutes(app: FastifyInstance, deps: HealthDeps): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get(
    "/health",
    {
      schema: {
        tags: ["system"],
        summary: "Liveness probe",
        response: { 200: z.object({ status: z.literal("ok"), version: z.string() }) },
      },
    },
    async () => ({ status: "ok" as const, version: deps.version }),
  );

  r.get(
    "/ready",
    {
      schema: {
        tags: ["system"],
        summary: "Readiness probe (checks upstream Stellar RPC when configured)",
        response: {
          200: z.object({ status: z.literal("ready"), checks: z.record(z.string(), z.string()) }),
          503: z.object({
            status: z.literal("not_ready"),
            checks: z.record(z.string(), z.string()),
          }),
        },
      },
    },
    async (_req, reply) => {
      const checks: Record<string, string> = {};
      if (deps.stellar) {
        try {
          checks.rpc = `ledger ${await deps.stellar.getLatestLedger()}`;
        } catch (err) {
          checks.rpc = `unavailable: ${err instanceof Error ? err.message : "unknown"}`;
          return reply.status(503).send({ status: "not_ready" as const, checks });
        }
      } else {
        checks.rpc = "not configured";
      }
      return { status: "ready" as const, checks };
    },
  );
}
