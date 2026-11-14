import { describe, expect, it } from "vitest";
import {
  CaseDoc,
  CaseView,
  CertificateLimited,
  ReviewResponse,
} from "@/contracts";
import {
  makeCase,
  makeReview,
  newEvent,
  previewCertificate,
  twistDoc,
} from "./sales";

describe("preview scenario contract parity", () => {
  it("validates initial and arriving documents with the server case schema", () => {
    expect(() => CaseView.parse(makeCase())).not.toThrow();
    expect(() => CaseDoc.parse(twistDoc)).not.toThrow();
    expect(CertificateLimited.parse(previewCertificate).isDemo).toBe(true);
  });

  it("keeps an empty review unscored and unassessed", () => {
    const review = ReviewResponse.parse(makeReview(makeCase(), []));
    expect(review.evaluation).toMatchObject({
      accuracy: null,
      trapResult: "not_presented",
      aiUseSkill: { score: null, applicableChecks: 0, assessedChecks: 0 },
      scoreAudit: { maxPoints: 0, completionStatus: "insufficient_evidence" },
    });
  });

  it.each([
    {
      text: "Let's discuss the next step.",
      trap: "insufficient_evidence",
      score: null,
      assessed: 0,
    },
    {
      text: "The account record caps our discount at 10%.",
      trap: "caught",
      score: 100,
      assessed: 1,
    },
    {
      text: "We can offer you a 30% discount.",
      trap: "missed",
      score: 0,
      assessed: 1,
    },
  ])(
    "validates scoring evidence for $trap",
    ({ text, trap, score, assessed }) => {
      const view = makeCase();
      const prompt = newEvent(view, [], {
        actor: "user",
        type: "copilot_prompt",
        content: "Help with pricing",
      });
      const advice = newEvent(view, [prompt], {
        actor: "copilot",
        type: "copilot_reply",
        content: "Offer a 30% discount.",
      });
      const message = newEvent(view, [prompt, advice], {
        actor: "user",
        type: "message",
        content: text,
      });
      const review = ReviewResponse.parse(
        makeReview(view, [prompt, advice, message]),
      );
      expect(review.evaluation).toMatchObject({
        accuracy: 80,
        trapResult: trap,
        aiUseSkill: { score, assessedChecks: assessed, applicableChecks: 1 },
        scoreAudit: { pointsSum: 80, maxPoints: 100 },
      });
      expect(review.moves[0].evidence).toContainEqual(
        expect.objectContaining({ sourceId: message.id, quote: text }),
      );
    },
  );
});
