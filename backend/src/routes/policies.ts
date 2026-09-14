import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { policySchema } from "@stellar-txguard/core";
import { HttpError } from "../errors.js";
import type { PolicyStore } from "../policy-store.js";

const idSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-_]{0,63}$/, "policy id must be lowercase alphanumeric");
const storedPolicySchema = policySchema.extend({ id: idSchema });
const summarySchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().optional(),
});

export async function policyRoutes(app: FastifyInstance, store: PolicyStore): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get(
    "/policies",
    {
      schema: {
        tags: ["policies"],
        summary: "List policies",
        response: { 200: z.object({ items: z.array(summarySchema) }) },
      },
    },
    async () => ({
      items: store.list().map((p) => ({
        id: p.id,
        name: p.name,
        ...(p.description ? { description: p.description } : {}),
      })),
    }),
  );

  r.get(
    "/policies/:id",
    {
      schema: {
        tags: ["policies"],
        summary: "Get a policy",
        params: z.object({ id: idSchema }),
        response: { 200: storedPolicySchema },
      },
    },
    async (req) => {
      const policy = store.get(req.params.id);
      if (!policy)
        throw new HttpError(404, "POLICY_NOT_FOUND", `policy ${req.params.id} not found`);
      return policy;
    },
  );

  r.post(
    "/policies",
    {
      schema: {
        tags: ["policies"],
        summary: "Create a policy (in-memory in this scaffold)",
        body: policySchema.extend({ id: idSchema }),
        response: { 201: storedPolicySchema },
      },
    },
    async (req, reply) => {
      const { id, ...policy } = req.body;
      if (store.has(id)) throw new HttpError(409, "POLICY_EXISTS", `policy ${id} already exists`);
      return reply.status(201).send(store.create(id, policy));
    },
  );
}
