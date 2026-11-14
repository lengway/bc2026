import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { z } from "zod";
import { apiClient, ApiError } from "./api-client";
const server = setupServer();
const schema = z.object({ name: z.string() });
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
describe("API boundary", () => {
  it("returns validated data and strips unexpected fields", async () => {
    server.use(
      http.get("*/api/test", () =>
        HttpResponse.json({ name: "Dana", hidden: "secret" }),
      ),
    );
    expect(await apiClient("/api/test", schema)).toEqual({ name: "Dana" });
  });
  it("turns invalid successful payloads into a safe recoverable error", async () => {
    server.use(http.get("*/api/test", () => HttpResponse.json({ name: 42 })));
    await expect(apiClient("/api/test", schema)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("does not expose an HTML error response to the user", async () => {
    server.use(
      http.get(
        "*/api/test",
        () => new HttpResponse("<html>private debug</html>", { status: 502 }),
      ),
    );
    await expect(apiClient("/api/test", schema)).rejects.toMatchObject({
      code: "UNAVAILABLE",
      status: 502,
    });
  });
  it("retains the structured paywall error", async () => {
    server.use(
      http.get("*/api/test", () =>
        HttpResponse.json(
          { error: { code: "PAYWALL", message: "Weekly cases require Pro." } },
          { status: 403 },
        ),
      ),
    );
    await expect(apiClient("/api/test", schema)).rejects.toMatchObject({
      code: "PAYWALL",
      message: "Weekly cases require Pro.",
      status: 403,
    });
  });
  it("maps failed connections without leaking fetch internals", async () => {
    server.use(http.get("*/api/test", () => HttpResponse.error()));
    await expect(apiClient("/api/test", schema)).rejects.toBeInstanceOf(
      ApiError,
    );
  });
  it("honors caller cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      apiClient("/api/test", schema, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: "REQUEST_ABORTED" });
  });
});
