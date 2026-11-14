import { describe, expect, it, vi } from "vitest";
import { readQuota } from "./repo";

vi.mock("@/modules/simulation", () => ({}));

const userId = "00000000-0000-4000-8000-000000000001";
const now = new Date("2026-11-14T12:00:00.000Z");
const attemptStart = new Date("2026-11-12T12:00:00.000Z");

function availability(used: number, next: string | null, attemptCount: number) {
  const db = {
    query: async () => ({
      rows: [{ used, next, attemptCount, attemptStart }],
      rowCount: 1,
    }),
  };
  return readQuota(db, userId, now);
}

describe("retake availability", () => {
  it("reports the attempt reset when failed attempts exhaust the allowance", async () => {
    await expect(availability(0, null, 6)).resolves.toEqual({
      remaining: 0,
      nextAvailableAt: "2026-11-19T12:00:00.000Z",
    });
  });

  it("uses the later reset when both allowances are exhausted", async () => {
    const completionReset = "2026-11-20T12:00:00.000Z";
    await expect(availability(3, completionReset, 6)).resolves.toEqual({
      remaining: 0,
      nextAvailableAt: completionReset,
    });
  });

  it("advertises only remaining attempts when they are the tighter allowance", async () => {
    await expect(availability(0, null, 5)).resolves.toEqual({
      remaining: 1,
      nextAvailableAt: null,
    });
  });
});
