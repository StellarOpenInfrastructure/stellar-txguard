import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { RpcSimulator, TxGuard, type StellarClient, type Simulator } from "@stellar-txguard/core";
import type { AppConfig } from "./config.js";
import { errorHandler } from "./errors.js";
import { createLogger } from "./logger.js";
import { PolicyStore } from "./policy-store.js";
import { healthRoutes } from "./routes/health.js";
import { inspectRoutes } from "./routes/inspect.js";
import { policyRoutes } from "./routes/policies.js";

export const APP_VERSION = "0.1.0";

export type App = Awaited<ReturnType<typeof buildApp>>;

export interface AppDeps {
  store?: PolicyStore;
  simulator?: Simulator;
  stellar?: StellarClient;
}

export async function buildApp(config: AppConfig, deps: AppDeps = {}) {
  const app = Fastify({
    loggerInstance: createLogger(config.LOG_LEVEL, config.NODE_ENV === "development"),
    genReqId: (req) => (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
    requestIdHeader: "x-request-id",
    bodyLimit: 512 * 1024,
    trustProxy: false,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.addHook("onSend", async (req, reply) => {
    reply.header("x-request-id", req.id);
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin:
      config.CORS_ORIGINS === "*" ? true : config.CORS_ORIGINS.split(",").map((s) => s.trim()),
  });
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "stellar-txguard API",
        description: "Transaction policy, simulation and risk firewall for Stellar applications.",
        version: APP_VERSION,
      },
      servers: [{ url: "/" }],
      tags: [
        { name: "system", description: "Health and readiness" },
        { name: "policies", description: "Policy management" },
        { name: "inspection", description: "Transaction inspection" },
      ],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  const store = deps.store ?? (await PolicyStore.fromDirectory(config.POLICY_DIR));
  let simulator = deps.simulator;
  if (!simulator && config.SIMULATION_ENABLED && config.network.rpcUrl) {
    simulator = new RpcSimulator({
      rpcUrl: config.network.rpcUrl,
      allowHttp: config.NODE_ENV !== "production",
    });
  }
  const guard = new TxGuard({
    ...(simulator ? { simulator } : {}),
    reviewAtRiskLevel: config.REVIEW_AT_RISK_LEVEL,
  });

  await app.register(async (instance) =>
    healthRoutes(instance, {
      version: APP_VERSION,
      ...(deps.stellar ? { stellar: deps.stellar } : {}),
    }),
  );
  await app.register(
    async (instance) => {
      await policyRoutes(instance, store);
      await inspectRoutes(instance, { guard, store, defaultPassphrase: config.network.passphrase });
      instance.get("/openapi.json", { schema: { hide: true } }, async () => app.swagger());
    },
    { prefix: "/api/v1" },
  );

  return app;
}
