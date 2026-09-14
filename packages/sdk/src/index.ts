import type { InspectionReport, Policy, PolicyInput } from "@stellar-txguard/core";

export type { InspectionReport, Policy, PolicyInput } from "@stellar-txguard/core";

export interface TxGuardClientOptions {
  /** Base URL of a stellar-txguard API, e.g. http://localhost:4010 */
  baseUrl: string;
  /** Optional bearer token forwarded as Authorization. Never logged by the client. */
  apiKey?: string;
  fetch?: typeof fetch;
  /** Request timeout in milliseconds (default 15000). */
  timeoutMs?: number;
}

export interface InspectOptions {
  envelopeXdr: string;
  networkPassphrase?: string;
  /** Either a stored policy id or an inline policy. */
  policyId?: string;
  policy?: PolicyInput;
  skipSimulation?: boolean;
  knownDestinations?: string[];
  knownContracts?: string[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; requestId?: string; details?: unknown };
}

export class TxGuardApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "TxGuardApiError";
  }
}

export interface PolicySummary {
  id: string;
  name: string;
  description?: string;
}

/** Thin, dependency-free HTTP client for the stellar-txguard API. */
export class TxGuardClient {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly opts: TxGuardClientOptions) {
    this.base = opts.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  inspect(options: InspectOptions): Promise<InspectionReport> {
    return this.request<InspectionReport>("POST", "/api/v1/inspect", options);
  }

  listPolicies(): Promise<PolicySummary[]> {
    return this.request<{ items: PolicySummary[] }>("GET", "/api/v1/policies").then((r) => r.items);
  }

  getPolicy(id: string): Promise<Policy & { id: string }> {
    return this.request<Policy & { id: string }>(
      "GET",
      `/api/v1/policies/${encodeURIComponent(id)}`,
    );
  }

  createPolicy(policy: PolicyInput): Promise<Policy & { id: string }> {
    return this.request<Policy & { id: string }>("POST", "/api/v1/policies", policy);
  }

  health(): Promise<{ status: string }> {
    return this.request<{ status: string }>("GET", "/health");
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (this.opts.apiKey) headers.authorization = `Bearer ${this.opts.apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      const json: unknown = text ? JSON.parse(text) : null;
      if (!res.ok) {
        const err = (json as ApiErrorBody | null)?.error;
        throw new TxGuardApiError(
          res.status,
          err?.code ?? "HTTP_ERROR",
          err?.message ?? `request failed with status ${res.status}`,
          err?.requestId,
          err?.details,
        );
      }
      return json as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
