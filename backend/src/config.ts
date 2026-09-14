import { z } from "zod";
import { NETWORKS } from "@stellar-txguard/core";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4010),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  STELLAR_NETWORK: z.enum(["testnet", "mainnet", "custom"]).default("testnet"),
  STELLAR_RPC_URL: z.string().url().optional(),
  STELLAR_HORIZON_URL: z.string().url().optional(),
  STELLAR_NETWORK_PASSPHRASE: z.string().optional(),
  /** Directory of *.yaml policy files loaded at startup. */
  POLICY_DIR: z.string().default("./examples/policies"),
  /** Risk level at or above which allowed transactions are sent to review. */
  REVIEW_AT_RISK_LEVEL: z.enum(["medium", "high", "critical"]).default("high"),
  /** Comma-separated list of allowed CORS origins; "*" for development. */
  CORS_ORIGINS: z.string().default("*"),
  /** Enable simulation via RPC. Disabled by default so tests never touch the network. */
  SIMULATION_ENABLED: z
    .string()
    .transform((v) => v === "true" || v === "1")
    .default(false),
});

export type Env = z.infer<typeof envSchema>;

export interface AppConfig extends Env {
  network: { passphrase: string; rpcUrl?: string; horizonUrl?: string };
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    // Never print the raw environment: only the field names that failed.
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`invalid configuration for: ${fields}`);
  }
  const env = parsed.data;
  const preset = env.STELLAR_NETWORK === "custom" ? undefined : NETWORKS[env.STELLAR_NETWORK];
  const passphrase = env.STELLAR_NETWORK_PASSPHRASE ?? preset?.passphrase;
  if (!passphrase)
    throw new Error("STELLAR_NETWORK_PASSPHRASE is required when STELLAR_NETWORK=custom");
  const rpcUrl = env.STELLAR_RPC_URL ?? (preset?.rpcUrl || undefined);
  const horizonUrl = env.STELLAR_HORIZON_URL ?? preset?.horizonUrl;
  return {
    ...env,
    network: { passphrase, ...(rpcUrl ? { rpcUrl } : {}), ...(horizonUrl ? { horizonUrl } : {}) },
  };
}
