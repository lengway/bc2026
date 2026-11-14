import { expect, it } from "vitest";
import {
  CaseResponse,
  CertificateFull,
  CertificateLimited,
  Evaluation,
} from "./contracts";
import {
  makeCase,
  makeReview,
  previewCertificate,
} from "@/mocks/scenarios/sales";
it("accepts generating without inventing a brief or scoring guide", () => {
  expect(
    CaseResponse.parse({
      id: "00000000-0000-4000-8000-000000000001",
      status: "generating",
    }),
  ).toEqual({
    id: "00000000-0000-4000-8000-000000000001",
    status: "generating",
  });
});
it("preserves null scores and unavailable observations for an empty case", () => {
  const result = Evaluation.parse(makeReview(makeCase(), []).evaluation);
  expect(result.accuracy).toBeNull();
  expect(result.assistance.copilotRetainedPercent).toBeNull();
  expect(result.aiUseSkill.score).toBeNull();
  expect(result.trapResult).toBe("not_presented");
});
it("excludes owner-only activity observations from every public certificate projection", () => {
  const evaluation = makeReview(makeCase(), []).evaluation;
  const full = CertificateFull.parse({
    ...previewCertificate,
    evaluation,
    moves: [],
    personas: [],
    transcript: [],
    editor_events: [{ insertedText: "private draft" }],
  });
  expect(full.evaluation).not.toHaveProperty("processObservations");
  expect(full).not.toHaveProperty("editor_events");
  const limited = CertificateLimited.parse(full);
  expect(limited).not.toHaveProperty("evaluation");
  expect(limited).not.toHaveProperty("moves");
  expect(limited.verificationScope).toBe("recorded_simulation");
});
