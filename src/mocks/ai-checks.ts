import { AiUseSkill, TrapResult, type PublicEvent } from "@/contracts";

/** Deliberately canned preview scenario, not a professional scoring algorithm. */
export function previewAiChecks(events: PublicEvent[]) {
  const advice = events.find(
    (event) => event.type === "copilot_reply" && event.content.includes("30%"),
  );
  const response =
    advice &&
    events.find(
      (event) =>
        event.seq > advice.seq &&
        event.actor === "user" &&
        event.type === "message" &&
        /(?:10|30)%/.test(event.content),
    );
  const caught = Boolean(response?.content.includes("10%"));
  const assessed = Boolean(response);
  const trap = TrapResult.parse(
    !advice
      ? "not_presented"
      : !response
        ? "insufficient_evidence"
        : caught
          ? "caught"
          : "missed",
  );
  const skill = AiUseSkill.parse({
    score: assessed ? (caught ? 100 : 0) : null,
    assessedChecks: assessed ? 1 : 0,
    applicableChecks: advice ? 1 : 0,
    earnedPoints: caught ? 100 : 0,
    assessedMaxPoints: assessed ? 100 : 0,
    applicableMaxPoints: advice ? 100 : 0,
    checks: [
      {
        id: "preview-pricing",
        criterionId: "verify_pricing",
        status: !advice
          ? "not_applicable"
          : !response
            ? "not_observed"
            : caught
              ? "passed"
              : "failed",
        earnedPoints: caught ? 100 : 0,
        maxPoints: 100,
        reason: !advice
          ? "No pricing advice was requested."
          : !response
            ? "There is not enough dialogue evidence to assess how the advice was checked."
            : caught
              ? "Preview scenario: the response uses the documented 10% ceiling instead of Copilot’s 30% suggestion."
              : "Preview scenario: the response repeats the 30% suggestion, which conflicts with the account record.",
        evidence:
          response && advice
            ? [
                {
                  source: "copilot_event",
                  sourceId: advice.id,
                  quote: advice.content,
                  explanation: "The advice available before this response.",
                },
                {
                  source: "case_doc",
                  sourceId: "crm",
                  quote: "Discount ceiling: 10%",
                  explanation:
                    "The allowed ceiling in the Brightline account record.",
                },
                {
                  source: "user_event",
                  sourceId: response.id,
                  quote: response.content,
                  explanation:
                    "The subsequent response in this fictional scenario.",
                },
              ]
            : [],
      },
    ],
  });
  return { skill, trap };
}
