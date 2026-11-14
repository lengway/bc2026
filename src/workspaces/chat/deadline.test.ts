import { expect, it } from "vitest";
import { remainingSeconds } from "./deadline";
it("uses server start time and clamps at zero after a suspended tab resumes", () => {
  const start = "2026-11-14T10:00:00.000Z";
  expect(remainingSeconds(start, 480, Date.parse(start) + 1250)).toBe(479);
  expect(remainingSeconds(start, 480, Date.parse(start) + 600000)).toBe(0);
  expect(remainingSeconds(null, 480, Date.parse(start))).toBeNull();
});
