import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiClient } from "./api-client";

// Plain fetch stub (no msw) so this runs everywhere, including CPUs without Wasm SIMD.
afterEach(() => vi.unstubAllGlobals());

function stubFetch() {
  const fetchMock = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

it("sends an empty JSON body on a bodyless POST, as the server CSRF guard requires", async () => {
  const fetchMock = stubFetch();
  await apiClient("/api/cases/x/start", z.object({ ok: z.boolean() }), {
    method: "POST",
  });
  const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
  expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
  expect(init.body).toBe("{}");
});

it("does not add a body or Content-Type to GET requests", async () => {
  const fetchMock = stubFetch();
  await apiClient("/api/cases/x", z.object({ ok: z.boolean() }));
  const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
  expect(new Headers(init.headers).get("Content-Type")).toBeNull();
  expect(init.body).toBeUndefined();
});
