import { describe, expect, it, vi } from "vitest";
import type { TxGuardApiError } from "./index.js";
import { TxGuardClient } from "./index.js";

function mockFetch(status: number, body: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

describe("TxGuardClient", () => {
  it("posts inspect requests and returns the report", async () => {
    const fetch = mockFetch(200, { recommendation: "sign" });
    const client = new TxGuardClient({ baseUrl: "http://guard.local/", fetch, apiKey: "k" });
    const report = await client.inspect({ envelopeXdr: "AAAA", policyId: "default" });
    expect(report.recommendation).toBe("sign");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://guard.local/api/v1/inspect");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer k");
  });

  it("maps API error envelopes to TxGuardApiError", async () => {
    const fetch = mockFetch(400, {
      error: { code: "INVALID_XDR", message: "bad", requestId: "r1" },
    });
    const client = new TxGuardClient({ baseUrl: "http://guard.local", fetch });
    await expect(client.inspect({ envelopeXdr: "x", policyId: "p" })).rejects.toMatchObject({
      name: "TxGuardApiError",
      status: 400,
      code: "INVALID_XDR",
      requestId: "r1",
    } satisfies Partial<TxGuardApiError>);
  });

  it("unwraps policy lists", async () => {
    const fetch = mockFetch(200, { items: [{ id: "a", name: "A" }] });
    const client = new TxGuardClient({ baseUrl: "http://guard.local", fetch });
    expect(await client.listPolicies()).toEqual([{ id: "a", name: "A" }]);
  });
});
