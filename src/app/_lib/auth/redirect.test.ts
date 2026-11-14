import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";
describe("auth return navigation", () => {
  it("preserves an app path and query", () =>
    expect(safeNextPath("/case/one?tab=docs")).toBe("/case/one?tab=docs"));
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
