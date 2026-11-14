import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";
describe("auth return navigation", () => {
  it("preserves an app path and query", () =>
    expect(safeNextPath("/case/one?tab=docs")).toBe("/case/one?tab=docs"));
  it.each([
    "/history?period=week",
    "/certificates",
    "/settings/learning",
    "/billing/success",
    "/help#scoring",
  ])("returns to the protected page %s", (path) =>
    expect(safeNextPath(path)).toBe(path),
  );
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%2f%2fevil.example",
    "/auth/callback",
    "/login",
    "javascript:alert(1)",
    null,
  ])("rejects an external or looping target %s", (value) =>
    expect(safeNextPath(value)).toBe("/dashboard"),
  );
});
